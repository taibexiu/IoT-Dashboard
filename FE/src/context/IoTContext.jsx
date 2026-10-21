import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, connectUpdates, controlDevice } from '../services/apiService';
import { useAuth } from './AuthContext';
const IoTContext = createContext(null);
export function IoTProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState({ sensors: [], series: [], devices: [] });
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const busy = useRef(new Set());
  useEffect(() => {
    if (!user) { setData({ sensors: [], series: [], devices: [] }); return; }
    let active = true, socket, timer, retry;
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      try { const result = await api('/dashboard'); if (active && current === generation) { setData(previous => ({ ...result, devices: result.devices.map(device => ({ ...device, error: previous.devices.find(item => item.id === device.id)?.error || '' })) })); setError(''); } }
      catch (error) { if (active) setError(error.message); }
    }
    async function connect() {
      try {
        const connected = await connectUpdates(message => {
          if (!active) return;
          if (message.type === 'device:updated') setData(previous => ({ ...previous, devices: previous.devices.map(device => device.id === message.data.id ? { ...device, ...message.data } : device) }));
          if (message.type !== 'connected') setRevision(value => value + 1);
          if (message.type === 'sensor:created') refresh();
        });
        if (!active) { connected.close(); return; }
        socket = connected;
        socket.onopen = () => { refresh(); setRevision(value => value + 1); };
        socket.onclose = () => { if (active) retry = setTimeout(connect, 2000); };
        socket.onerror = () => socket.close();
      } catch { if (active) retry = setTimeout(connect, 2000); }
    }
    refresh(); connect(); timer = setInterval(refresh, 10000);
    return () => { active = false; clearInterval(timer); clearTimeout(retry); socket?.close(); };
  }, [user]);
  async function toggleDevice(id) {
    const device = data.devices.find(item => item.id === id);
    if (!device || device.pending || busy.current.has(id)) return;
    busy.current.add(id);
    setData(previous => ({ ...previous, devices: previous.devices.map(item => item.id === id ? { ...item, pending: true, error: '' } : item) }));
    try { const result = await controlDevice(id, device.status === 'ON' ? 'OFF' : 'ON');
      // Tr?ng th?i k?t th?c do WebSocket g?i; ch? ?p d?ng l?i t?c th?i t? REST.
      if (result.action.status === 'FAILED') setData(previous => ({ ...previous, devices: previous.devices.map(item => item.id === id ? { ...item, ...result.device, pending: false } : item) }));
      setRevision(value => value + 1);
    } catch (error) { setData(previous => ({ ...previous, devices: previous.devices.map(item => item.id === id ? { ...item, pending: false, error: error.message } : item) })); }
    finally { busy.current.delete(id); }
  }
  return <IoTContext.Provider value={{ ...data, revision, error, toggleDevice }}>{children}</IoTContext.Provider>;
}
export const useIoT = () => useContext(IoTContext);
