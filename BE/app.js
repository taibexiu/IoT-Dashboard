import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { startMqtt } from './mqtt.js';

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function text(value, name, max = 100) {
  if (typeof value !== 'string' || value.trim().length > max) fail(`${name} không hợp lệ.`);
  return value.trim();
}
function choice(value, allowed, name) { if (!allowed.includes(value)) fail(`${name} không hợp lệ.`); return value; }
function pagination(query) {
  const page = Number(query.page ?? 1), pageSize = Number(query.pageSize ?? 10);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || ![10, 20].includes(pageSize)) fail('Trang hoặc số bản ghi không hợp lệ (10/20).');
  return { page, pageSize };
}
function publicUser(user) { const { password, ...profile } = user; return profile; }

export function createBackend(store, config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin(origin, callback) { callback(null, !origin || config.origins.includes(origin)); } }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const tickets = new Map();

  function session(user) {
    return { user: publicUser(user), token: jwt.sign({}, config.secret, { subject: String(user.id), expiresIn: '1h', issuer: 'iot-backend', audience: 'iot-frontend' }) };
  }
  async function authenticate(req, res, next) {
    try {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) fail('Vui lòng đăng nhập.', 401);
      let claims;
      try { claims = jwt.verify(token, config.secret, { algorithms: ['HS256'], issuer: 'iot-backend', audience: 'iot-frontend' }); }
      catch { fail('Phiên đăng nhập hết hạn hoặc không hợp lệ.', 401); }
      const user = await store.user(Number(claims.sub));
      if (!user) fail('Tài khoản không tồn tại.', 401);
      req.user = user; req.expires = claims.exp * 1000; next();
    } catch (error) { next(error); }
  }
  function broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(message);
  }
  const bridge = config.mode === 'sql' && config.mqtt ? startMqtt(store, config.mqtt, broadcast) : null;

  app.get('/api/health', (req, res) => res.json({ status: 'ok', dataMode: config.mode }));
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const username = text(req.body?.username, 'Tên đăng nhập', 100);
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length > 72) fail('Mật khẩu không hợp lệ.');
    const user = await store.findUser(username);
    if (!user || !await bcrypt.compare(password, user.password)) fail('Tên đăng nhập hoặc mật khẩu chưa đúng.', 401);
    res.json(session(user));
  });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const username = text(req.body?.username, 'Tên đăng nhập', 100), fullname = text(req.body?.fullname, 'Họ tên', 255), email = text(req.body?.email, 'Email', 255);
    if (!/^[a-zA-Z0-9_.-]{3,100}$/.test(username) || !fullname || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Kiểm tra tên đăng nhập, họ tên và email.');
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password) > 72) fail('Mật khẩu cần ít nhất 6 ký tự và tối đa 72 byte.');
    const user = await store.register({ username, fullname, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json(session(user));
  });
  app.get('/api/auth/me', authenticate, (req, res) => res.json(publicUser(req.user)));
  app.get('/api/devices', authenticate, async (req, res) => { const devices = await store.devices(); res.json(bridge ? bridge.decorate(devices) : devices); });
  app.get('/api/sensors', authenticate, async (req, res) => {
    const filters = { ...pagination(req.query), type: choice(req.query.type ?? 'all', ['all', 'temperature', 'humidity', 'light', 'time'], 'Loại cảm biến'), keyword: text(req.query.keyword ?? '', 'Giá trị tìm kiếm') };
    if (filters.type !== 'time' && filters.keyword && !Number.isFinite(Number(filters.keyword))) fail('Giá trị cảm biến phải là số.');
    res.json(await store.sensors(filters));
  });
  app.get('/api/actions', authenticate, async (req, res) => {
    const deviceId = req.query.deviceId ? Number(req.query.deviceId) : 0;
    if (!Number.isSafeInteger(deviceId) || deviceId < 0 || deviceId > 2147483647) fail('Thiết bị không hợp lệ.');
    const filters = { ...pagination(req.query), deviceId, action: choice(req.query.action ?? '', ['', 'ON', 'OFF'], 'Hành động'), status: choice(req.query.status ?? '', ['', 'SUCCESS', 'LOADING', 'FAILED'], 'Trạng thái'), time: text(req.query.time ?? '', 'Thời gian', 50) };
    res.json(await store.actions(filters));
  });
  app.get('/api/dashboard', authenticate, async (req, res) => {
    const [devices, series, readings] = await Promise.all([store.devices(), store.series(), store.sensors({ page: 1, pageSize: 10, type: 'all', keyword: '' })]);
    res.json({ devices: bridge ? bridge.decorate(devices) : devices, series, sensors: readings.items });
  });
  app.post('/api/devices/:id/control', authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) fail('Thiết bị không hợp lệ.');
    const action = choice(req.body?.action, ['ON', 'OFF'], 'Hành động');
    const result = await (bridge ? bridge.control(id, action, req.user.id) : store.control(id, action, req.user.id));
    if (!result) fail('Không tìm thấy thiết bị.', 404);
    if (!bridge) { broadcast('device:updated', result.device); broadcast('action:created', result.action); }
    res.json(result);
  });
  app.post('/api/sensors', async (req, res) => {
    const key = req.headers['x-device-key'];
    if (typeof key !== 'string' || Buffer.byteLength(key) !== Buffer.byteLength(config.deviceKey) || !timingSafeEqual(Buffer.from(key), Buffer.from(config.deviceKey))) fail('Khóa thiết bị không hợp lệ.', 401);
    const values = {};
    for (const [name, min, max] of [['temperature', -100, 200], ['humidity', 0, 100], ['light', 0, 1000000]]) {
      const value = req.body?.[name];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${name} không hợp lệ.`);
      values[name] = value;
    }
    const readings = await store.ingest(values);
    broadcast('sensor:created', readings);
    res.status(201).json(readings);
  });

  // Ticket dùng 1 lần, 30 giây. Không đưa JWT vào URL WebSocket.
  app.post('/api/ws-ticket', authenticate, (req, res) => {
    const ticket = randomBytes(32).toString('hex');
    tickets.set(ticket, { userId: req.user.id, expires: Date.now() + 30000, sessionExpires: req.expires });
    res.json({ ticket, expiresIn: 30 });
  });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    const key = url.searchParams.get('ticket'), ticket = tickets.get(key);
    tickets.delete(key);
    if (url.pathname !== '/ws' || (req.headers.origin && !config.origins.includes(req.headers.origin)) || !ticket || ticket.expires < Date.now() || ticket.sessionExpires < Date.now()) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, client => {
      client.isAlive = true; client.sessionExpires = ticket.sessionExpires;
      client.on('pong', () => { client.isAlive = true; });
      client.on('error', () => client.terminate());
      client.send(JSON.stringify({ type: 'connected', data: { userId: ticket.userId } }));
    });
  });
  const heartbeat = setInterval(() => {
    for (const [key, ticket] of tickets) if (ticket.expires < Date.now()) tickets.delete(key);
    for (const client of wss.clients) {
      if (!client.isAlive || client.sessionExpires < Date.now()) { client.terminate(); continue; }
      client.isAlive = false; client.ping();
    }
  }, 30000);
  heartbeat.unref();
  app.use((req, res) => res.status(404).json({ message: 'Không tìm thấy API.' }));
  app.use((error, req, res, next) => {
    const status = error.status || 500;
    if (status >= 500) console.error(error.message);
    res.status(status).json({ message: status >= 500 ? 'Không thể xử lý dữ liệu. Kiểm tra kết nối SQL Server.' : error.message });
  });
  return {
    app, server,
    async close() { if (bridge) await bridge.close(); clearInterval(heartbeat); for (const client of wss.clients) client.terminate(); await new Promise(resolve => wss.close(resolve)); if (server.listening) await new Promise(resolve => server.close(resolve)); await store.close(); },
  };
}
