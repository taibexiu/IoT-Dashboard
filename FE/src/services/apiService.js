const base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
export const tokenKey = 'iot-token';
export async function api(path, options = {}) {
  const token = sessionStorage.getItem(tokenKey);
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event('iot-session-expired'));
    throw new Error(data.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
  }
  return data;
}
export const login = (username, password) => api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const register = account => api('/auth/register', { method: 'POST', body: JSON.stringify(account) });
export const getSensors = filters => api(`/sensors?${new URLSearchParams(filters)}`);
export const getActions = filters => api(`/actions?${new URLSearchParams(filters)}`);
export const controlDevice = (id, action) => api(`/devices/${id}/control`, { method: 'POST', body: JSON.stringify({ action }) });
export async function connectUpdates(onMessage) {
  const { ticket } = await api('/ws-ticket', { method: 'POST' });
  const url = new URL(base); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.pathname = '/ws'; url.search = new URLSearchParams({ ticket }).toString();
  const socket = new WebSocket(url);
  socket.onmessage = event => { try { onMessage(JSON.parse(event.data)); } catch { /* Bỏ qua gói không hợp lệ. */ } };
  return socket;
}
