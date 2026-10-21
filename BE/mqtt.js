import mqtt from 'mqtt';

function parse(message, keys) {
  const pairs = message.toString().split(',').map(part => part.trim().split('='));
  if (pairs.length !== keys.length || pairs.some(pair => pair.length !== 2) || new Set(pairs.map(pair => pair[0])).size !== keys.length) throw new Error('Sai định dạng MQTT');
  const data = Object.fromEntries(pairs);
  if (keys.some(key => !(key in data) || data[key] === '')) throw new Error('Thiếu trường MQTT');
  return data;
}

export function startMqtt(store, config, broadcast) {
  const pending = new Map();
  let ready = false, closed = false, queue = Promise.resolve();
  const client = mqtt.connect(config.url, { username: config.username, password: config.password, reconnectPeriod: 2000, connectTimeout: 5000, clean: true, queueQoSZero: false });
  function enqueue(task) { queue = queue.then(task).catch(error => console.error('MQTT:', error.message)); return queue; }
  async function finish(id, status) {
    const job = pending.get(id);
    if (!job?.entry) return;
    clearTimeout(job.timer); pending.delete(id);
    const action = await store.finishAction(job.entry.id, status);
    broadcast('action:updated', action);
    broadcast('device:updated', { id, pending: false, error: status === 'FAILED' ? 'Không nhận được xác nhận từ ESP32. Thử lại.' : '' });
  }
  client.on('connect', () => {
    client.subscribe(['datasensor', 'status'], { qos: 0 }, (error, granted) => {
      ready = !error && granted?.every(item => item.qos !== 128);
      console.log(ready ? 'MQTT đã kết nối và đăng ký datasensor/status.' : 'Không đăng ký được MQTT topic.');
    });
  });
  client.on('error', error => console.error('MQTT:', error.message));
  client.on('close', () => { ready = false; enqueue(async () => { for (const id of [...pending.keys()]) await finish(id, 'FAILED'); }); });
  client.on('message', (topic, payload, packet) => {
    if (packet.retain || closed || payload.length > 512) return;
    enqueue(async () => {
      if (topic === 'datasensor') {
        const data = parse(payload, ['temperature', 'humidity', 'light']);
        for (const key of Object.keys(data)) data[key] = Number(data[key]);
        if (!Object.values(data).every(Number.isFinite) || data.temperature < -100 || data.temperature > 200 || data.humidity < 0 || data.humidity > 100 || data.light < 0 || data.light > 4095) throw new Error('Giá trị cảm biến ngoài phạm vi');
        broadcast('sensor:created', await store.ingest(data));
      } else if (topic === 'status') {
        const states = parse(payload, ['LED1', 'LED2', 'LED3']);
        if (Object.values(states).some(value => !['ON', 'OFF'].includes(value))) throw new Error('Trạng thái LED không hợp lệ');
        for (const device of await store.syncDevices(states)) broadcast('device:updated', { ...device, pending: pending.has(device.id) });
        for (const [id, job] of pending) if (job.sent && states[`LED${id}`] === job.action) await finish(id, 'SUCCESS');
      }
    });
  });
  return {
    async control(id, action, userId) {
      if (pending.has(id)) throw Object.assign(new Error('Thiết bị đang xử lý.'), { status: 409 });
      const lock = { action, sent: false }; pending.set(id, lock);
      try {
        const device = (await store.devices()).find(item => item.id === id);
        if (!device) { pending.delete(id); return null; }
        lock.entry = await store.startAction(id, action, userId);
        broadcast('action:created', lock.entry);
        broadcast('device:updated', { id, pending: true, error: '' });
        if (!ready) {
          await finish(id, 'FAILED');
          return { device: { ...device, pending: false, error: 'Chưa kết nối MQTT broker.' }, action: { ...lock.entry, status: 'FAILED' } };
        }
        lock.timer = setTimeout(() => enqueue(() => finish(id, 'FAILED')), config.timeout);
        lock.sent = true;
        // Không retain lệnh: tránh bật đèn ngoài ý muốn khi ESP32 kết nối lại.
        client.publish('control', `LED${id}_${action}`, { qos: 0, retain: false }, error => { if (error) enqueue(() => finish(id, 'FAILED')); });
        return { device: { ...device, pending: pending.has(id) }, action: lock.entry };
      } catch (error) { if (lock.entry) await finish(id, 'FAILED'); else pending.delete(id); throw error; }
    },
    decorate(devices) { return devices.map(device => ({ ...device, pending: pending.has(device.id) })); },
    async close() { closed = true; await new Promise(resolve => client.end(true, {}, resolve)); await queue; for (const id of [...pending.keys()]) await finish(id, 'FAILED'); },
  };
}
