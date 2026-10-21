import bcrypt from 'bcryptjs';
import { sql } from './database.js';

const definitions = [
  { type: 'temperature', sensorName: 'Nhiệt độ', unit: '°C' },
  { type: 'humidity', sensorName: 'Độ ẩm', unit: '%' },
  { type: 'light', sensorName: 'Độ sáng', unit: 'ADC' },
];
const readingFrom = 'dbo.DataSensor r JOIN dbo.Sensors s ON s.ID=r.IDsensor';
const readingColumns = 'r.ID AS id, r.IDsensor AS sensorId, s.type, s.sensorname AS sensorName, r.Value AS value, s.unit, r.datetime';
const actionColumns = 'a.ID AS id, a.IDdevice AS deviceId, d.devicename AS deviceName, a.IDuser AS userId, u.username AS [user], a.action, a.status, a.time';
const actionFrom = 'dbo.ActionHistory a JOIN dbo.Devices d ON d.ID=a.IDdevice JOIN dbo.Users u ON u.ID=a.IDuser';
const userColumns = 'ID AS id, fullname, username, password, email, github, postman, figma, pdf';

export function sqlStore(pool) {
  const request = params => {
    const req = pool.request();
    for (const [name, value] of Object.entries(params)) req.input(name, value);
    return req;
  };
  async function list(table, columns, where, params, filters) {
    const req = request({ ...params, offset: (filters.page - 1) * filters.pageSize, size: filters.pageSize });
    const result = await req.query(`SELECT ${columns} FROM ${table} WHERE ${where} ORDER BY ${table === actionFrom ? 'a.ID' : 'r.ID'} DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY; SELECT COUNT(*) AS total FROM ${table} WHERE ${where};`);
    return paginated(result.recordsets[0], result.recordsets[1][0].total, filters);
  }
  return {
    close: () => pool.close(),
    async startAction(deviceId, action, userId) {
      return (await request({ deviceId, action, userId }).query(`INSERT dbo.ActionHistory(IDdevice,IDuser,action,status,time) VALUES(@deviceId,@userId,@action,'LOADING',SYSUTCDATETIME()); SELECT ${actionColumns} FROM ${actionFrom} WHERE a.id=SCOPE_IDENTITY();`)).recordset[0];
    },
    async finishAction(id, status) {
      return (await request({ id, status }).query(`UPDATE dbo.ActionHistory SET status=@status WHERE id=@id; SELECT ${actionColumns} FROM ${actionFrom} WHERE a.id=@id;`)).recordset[0];
    },
    async syncDevices(states) {
      await request(states).query('UPDATE dbo.Devices SET status=CASE id WHEN 1 THEN @LED1 WHEN 2 THEN @LED2 WHEN 3 THEN @LED3 END WHERE id IN (1,2,3)');
      return (await pool.request().query('SELECT ID AS id,devicename AS name,status FROM dbo.Devices ORDER BY id')).recordset;
    },
    async recoverActions() { await pool.request().query("UPDATE dbo.ActionHistory SET status='FAILED' WHERE status='LOADING'"); },
    async findUser(username) { return (await request({ username }).query(`SELECT ${userColumns} FROM dbo.Users WHERE username=@username`)).recordset[0]; },
    async user(id) { return (await request({ id }).query(`SELECT ${userColumns} FROM dbo.Users WHERE id=@id`)).recordset[0]; },
    async register(user) {
      try {
        return (await request(user).query('INSERT dbo.Users(fullname,username,password,email) OUTPUT INSERTED.ID AS id,INSERTED.fullname,INSERTED.username,INSERTED.email VALUES(@fullname,@username,@password,@email)')).recordset[0];
      } catch (error) { if ([2601, 2627].includes(error.number)) { error.status = 409; error.message = 'Tên đăng nhập đã tồn tại.'; } throw error; }
    },
    async devices() { return (await pool.request().query('SELECT ID AS id,devicename AS name,status FROM dbo.Devices ORDER BY id')).recordset; },
    async sensors(filters) {
      const time = "(CONVERT(varchar(19),DATEADD(hour,7,datetime),120) LIKE @keyword OR CONVERT(varchar(10),DATEADD(hour,7,datetime),103)+' '+CONVERT(varchar(8),DATEADD(hour,7,datetime),108) LIKE @keyword)";
      const where = filters.type === 'time' ? time : '(@type=\'all\' OR s.type=@type) AND (@value IS NULL OR r.Value=@value)';
      return list(readingFrom, readingColumns, where, { type: filters.type, keyword: `%${escapeLike(normalizeTime(filters.keyword))}%`, value: filters.keyword && filters.type !== 'time' ? Number(filters.keyword) : null }, filters);
    },
    async actions(filters) {
      const where = "(@deviceId IS NULL OR a.IDdevice=@deviceId) AND (@action='' OR a.action=@action) AND (@status='' OR a.status=@status) AND (CONVERT(varchar(19),DATEADD(hour,7,a.time),120) LIKE @time OR CONVERT(varchar(10),DATEADD(hour,7,a.time),103)+' '+CONVERT(varchar(8),DATEADD(hour,7,a.time),108) LIKE @time)";
      return list(actionFrom, actionColumns, where, { deviceId: filters.deviceId || null, action: filters.action, status: filters.status, time: `%${escapeLike(normalizeTime(filters.time))}%` }, filters);
    },
    async series() {
      return (await pool.request().query("SELECT * FROM (SELECT TOP 30 r.datetime AS time, MAX(CASE WHEN s.type='temperature' THEN r.Value END) AS temperature, MAX(CASE WHEN s.type='humidity' THEN r.Value END) AS humidity, MAX(CASE WHEN s.type='light' THEN r.Value END) AS light FROM dbo.DataSensor r JOIN dbo.Sensors s ON s.ID=r.IDsensor GROUP BY r.datetime ORDER BY r.datetime DESC) points ORDER BY time")).recordset;
    },
    async ingest(values) {
      const result = await request({ ...values, time: new Date() }).query("DECLARE @inserted TABLE (id INT); INSERT dbo.DataSensor(IDsensor,Value,datetime) OUTPUT INSERTED.ID INTO @inserted SELECT ID, CASE type WHEN 'temperature' THEN @temperature WHEN 'humidity' THEN @humidity ELSE @light END, @time FROM dbo.Sensors WHERE type IN ('temperature','humidity','light'); SELECT " + readingColumns + " FROM " + readingFrom + " WHERE r.ID IN (SELECT id FROM @inserted) ORDER BY r.ID DESC");
      return result.recordset;
    },
    async control(id, action, userId) {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        const req = new sql.Request(transaction).input('id', sql.Int, id).input('action', sql.VarChar(3), action).input('userId', sql.Int, userId);
        const result = await req.query(`UPDATE dbo.Devices SET status=@action OUTPUT INSERTED.ID AS id,INSERTED.devicename AS name,INSERTED.status WHERE id=@id; IF @@ROWCOUNT>0 BEGIN INSERT dbo.ActionHistory(IDdevice,IDuser,action,status,time) VALUES(@id,@userId,@action,'SUCCESS',SYSUTCDATETIME()); SELECT ${actionColumns} FROM ${actionFrom} WHERE a.id=SCOPE_IDENTITY(); END`);
        await transaction.commit();
        return result.recordsets[0].length ? { device: result.recordsets[0][0], action: result.recordsets[1][0] } : null;
      } catch (error) { await transaction.rollback(); throw error; }
    },
  };
}

function escapeLike(value) { return value.replace(/[\[%_]/g, char => `[${char}]`); }
function normalizeTime(value) { return value.trim().replace(/\s+/g, ' ').replace(/(\d)T(?=\d)/, '$1 '); }
function paginated(items, total, { page, pageSize }) { return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }; }
function matchesTime(value, keyword) {
  keyword = normalizeTime(keyword);
  const time = new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  const [year, month, day] = time.slice(0, 10).split('-');
  return time.includes(keyword) || `${day}/${month}/${year} ${time.slice(11)}`.includes(keyword);
}

// Dùng khi chưa có SQL Server để thử API/WebSocket. Không ghi ra database.
export async function demoStore() {
  const users = [{ id: 1, username: 'letantai', fullname: 'Lê Tấn Tài', email: 'admin@gmail.com', password: await bcrypt.hash('123456', 10) }];
  const devices = [1, 2, 3].map(id => ({ id, name: `LED ${id}`, status: id === 2 ? 'OFF' : 'ON' }));
  const readings = [], history = [];
  for (let index = 0; index < 30; index++) {
    const time = new Date(Date.now() - (29 - index) * 60000).toISOString();
    for (const def of definitions) readings.push({ ...def, id: readings.length + 1, value: def.type === 'temperature' ? 26 + index % 3 : def.type === 'humidity' ? 65 + index % 6 : 450 + index, datetime: time });
    history.push({ id: index + 1, deviceId: index % 3 + 1, deviceName: `LED ${index % 3 + 1}`, userId: 1, user: 'letantai', action: index % 2 ? 'OFF' : 'ON', status: ['SUCCESS', 'SUCCESS', 'LOADING', 'FAILED', 'SUCCESS'][index % 5], time });
  }
  const page = (items, filters) => paginated(items.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize), items.length, filters);
  return {
    close: async () => {}, findUser: async username => users.find(user => user.username === username), user: async id => users.find(user => user.id === id),
    async register(user) { if (users.some(item => item.username === user.username)) throw Object.assign(new Error('Tên đăng nhập đã tồn tại.'), { status: 409 }); const saved = { ...user, id: users.length + 1 }; users.push(saved); return saved; },
    devices: async () => devices.map(item => ({ ...item })),
    sensors: async filters => page([...readings].reverse().filter(item => filters.type === 'time' ? matchesTime(item.datetime, filters.keyword) : (filters.type === 'all' || item.type === filters.type) && (!filters.keyword || item.value === Number(filters.keyword))), filters),
    actions: async filters => page([...history].reverse().filter(item => (!filters.deviceId || item.deviceId === filters.deviceId) && (!filters.action || item.action === filters.action) && (!filters.status || item.status === filters.status) && matchesTime(item.time, filters.time)), filters),
    async series() { const grouped = new Map(); for (const item of readings) { const point = grouped.get(item.datetime) || { time: item.datetime }; point[item.type] = item.value; grouped.set(item.datetime, point); } return [...grouped.values()].slice(-30); },
    async ingest(values) { const datetime = new Date().toISOString(); const items = definitions.map(def => ({ ...def, id: readings.length + definitions.indexOf(def) + 1, value: values[def.type], datetime })); readings.push(...items); return items; },
    async control(id, action, userId) { const device = devices.find(item => item.id === id); if (!device) return null; device.status = action; const entry = { id: history.length + 1, deviceId: id, deviceName: device.name, userId, user: users.find(item => item.id === userId).username, action, status: 'SUCCESS', time: new Date().toISOString() }; history.push(entry); return { device: { ...device }, action: entry }; },
  };
}
