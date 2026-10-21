import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import DataSensor from './components/DataSensor';
import ActionHistory from './components/ActionHistory';
import Profile from './components/Profile';

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="data-sensor" element={<DataSensor />} />
        <Route path="action-history" element={<ActionHistory />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}


const titles = {
  '/': 'Dashboard',
  '/data-sensor': 'Dữ liệu cảm biến',
  '/action-history': 'Lịch sử hoạt động',
  '/profile': 'Thông tin cá nhân',
};

function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = titles[pathname] || 'Hệ Thống IOT';

  useEffect(() => { document.title = `${title} · Hệ Thống IOT`; }, [title]);

  function handleLogout() { logout(); }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} onLogout={handleLogout} loggingOut={false} />
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <button className="icon-button mobile-only" onClick={() => setMenuOpen(true)} aria-label="Mở menu" aria-expanded={menuOpen}><Menu size={21} /></button>
            <span>{title}</span>
          </div>
          <div className="account"><span className="status-dot" aria-hidden="true" />{user.username}</div>
        </header>
        <main id="main-content" className={`main-content ${pathname === '/profile' ? 'profile-content' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
