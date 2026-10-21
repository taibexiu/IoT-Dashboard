import { createContext, useContext, useEffect, useState } from 'react';
import { api, login as loginApi, register as registerApi, tokenKey } from '../services/apiService';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  function logout() { sessionStorage.removeItem(tokenKey); setUser(null); }
  useEffect(() => {
    let active = true;
    if (sessionStorage.getItem(tokenKey)) api('/auth/me').then(profile => { if (active) setUser(profile); }).catch(logout).finally(() => { if (active) setChecking(false); });
    else setChecking(false);
    window.addEventListener('iot-session-expired', logout);
    return () => { active = false; window.removeEventListener('iot-session-expired', logout); };
  }, []);
  function save(session) { sessionStorage.setItem(tokenKey, session.token); setUser(session.user); }
  async function login(username, password) { save(await loginApi(username, password)); }
  async function register(account) { save(await registerApi(account)); }
  return <AuthContext.Provider value={{ user, login, logout, register }}>{checking ? <p role="status">Loading...</p> : children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
