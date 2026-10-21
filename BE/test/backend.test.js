import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { WebSocket } from 'ws';
import { demoStore } from '../store.js';
import { createBackend } from '../app.js';

test('API: auth, pagination, filters, LED history and WebSocket', async t => {
  const config = { mode: 'demo', origins: ['http://127.0.0.1:5173'], secret: 'test-secret-only-abcdefghijklmnopqrstuvwxyz', deviceKey: 'test-device-key-abcdefghijklmnopqrstuvwxyz' };
  const backend = createBackend(await demoStore(), config);
  backend.server.listen(0, '127.0.0.1');
  await once(backend.server, 'listening');
  t.after(() => backend.close());
  const base = `http://127.0.0.1:${backend.server.address().port}`;
  let token;
  async function api(path, options = {}) {
    const res = await fetch(`${base}/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
    return { status: res.status, body: await res.json() };
  }
  assert.equal((await api('/actions')).status, 401);
  assert.equal((await api('/auth/login', { method: 'POST', body: { username: 'letantai', password: 'wrong' } })).status, 401);
  const login = await api('/auth/login', { method: 'POST', body: { username: 'letantai', password: '123456' } });
  assert.equal(login.status, 200); assert.equal(login.body.user.password, undefined); token = login.body.token;
  assert.equal((await api('/auth/me')).body.username, 'letantai');
  const sensors = await api('/sensors?pageSize=20');
  assert.equal(sensors.body.items.length, 20); assert.equal(sensors.body.total, 90);
  assert.equal((await api('/sensors?pageSize=11')).status, 400);
  assert.equal((await api('/sensors?keyword=abc')).status, 400);
  for (const status of ['SUCCESS', 'LOADING', 'FAILED']) {
    const rows = (await api(`/actions?status=${status}`)).body.items;
    assert.ok(rows.length > 0); assert.ok(rows.every(item => item.status === status));
  }
  const actions = await api('/actions?action=OFF&deviceId=2');
  assert.ok(actions.body.items.every(item => item.action === 'OFF' && item.deviceId === 2));
  assert.equal((await api('/sensors?type=time&keyword=not-a-time')).body.total, 0);
  assert.equal((await api('/dashboard')).body.series.length, 30);

  // Dán thời gian trong bảng rồi xóa dần giây/phút/giờ/ngày/tháng vẫn tìm thấy dòng đó.
  for (const [path, field, query] of [['/sensors', 'datetime', 'type=time&keyword='], ['/actions', 'time', 'time=']]) {
    const item = (await api(path)).body.items[0];
    const displayed = new Date(new Date(item[field]).getTime() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    for (const length of [19, 16, 13, 10, 7, 4]) {
      const result = await api(`${path}?${query}${encodeURIComponent(displayed.slice(0, length))}`);
      assert.equal(result.status, 200);
      assert.ok(result.body.items.some(row => row.id === item.id), `Không tìm được ${displayed.slice(0, length)}`);
    }
    const spaced = displayed.replace(' ', '   ');
    assert.ok((await api(`${path}?${query}${encodeURIComponent(spaced)}`)).body.items.some(row => row.id === item.id));
  }

  const ticket = (await api('/ws-ticket', { method: 'POST' })).body.ticket;
  const socket = new WebSocket(`${base.replace('http:', 'ws:')}/ws?ticket=${ticket}`, { origin: config.origins[0] });
  const messages = [];
  socket.on('message', value => messages.push(JSON.parse(value)));
  await once(socket, 'open');
  const nextMessage = once(socket, 'message');
  const control = await api('/devices/1/control', { method: 'POST', body: { action: 'OFF' } });
  assert.equal(control.body.device.status, 'OFF'); assert.equal(control.body.action.status, 'SUCCESS'); assert.equal(control.body.action.user, 'letantai');
  await nextMessage;
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(messages.some(message => message.type === 'device:updated'));
  assert.ok(messages.some(message => message.type === 'action:created'));
  assert.equal((await api('/actions')).body.total, 31);
  assert.equal((await api('/devices/999/control', { method: 'POST', body: { action: 'ON' } })).status, 404);
  assert.equal((await api('/devices/1/control', { method: 'POST', body: { action: 'BAD' } })).status, 400);
  const rejected = new WebSocket(`${base.replace('http:', 'ws:')}/ws?ticket=${ticket}`);
  const [error] = await once(rejected, 'error'); assert.match(error.message, /401/);

  assert.equal((await api('/sensors', { method: 'POST', body: { temperature: 27, humidity: 70, light: 500 } })).status, 401);
  const sensorMessage = once(socket, 'message');
  const inserted = await api('/sensors', { method: 'POST', headers: { 'X-Device-Key': config.deviceKey }, body: { temperature: 27, humidity: 70, light: 500 } });
  assert.equal(inserted.status, 201); assert.equal(inserted.body.length, 3);
  const [data] = await sensorMessage; assert.equal(JSON.parse(data).type, 'sensor:created');
  assert.equal((await api('/sensors')).body.total, 93);
  assert.equal((await api('/sensors', { method: 'POST', headers: { 'X-Device-Key': config.deviceKey }, body: { temperature: 27, humidity: 101, light: 500 } })).status, 400);
  socket.close(); await once(socket, 'close');

  const account = { username: 'student', password: 'abcdef', fullname: 'Student', email: 'student@example.com' };
  assert.equal((await api('/auth/register', { method: 'POST', body: account })).status, 201);
  assert.equal((await api('/auth/register', { method: 'POST', body: account })).status, 409);
  assert.equal((await api('/auth/login', { method: 'POST', body: account })).status, 200);
  token = 'bad'; assert.equal((await api('/devices')).status, 401);
});

test('Seed letantai bcrypt hash matches demo login password', async () => {
  const seed = await readFile(new URL('../dataseed.sql', import.meta.url), 'utf8');
  const hash = seed.match(/\$2b\$10\$[A-Za-z0-9./]{53}/)?.[0];
  assert.ok(hash); assert.equal(await bcrypt.compare('123456', hash), true);
});
