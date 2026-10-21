import './Sidebar.css';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Database, Clock3, UserRound, LogOut, X } from 'lucide-react';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/data-sensor', label: 'Data Sensor', icon: Database },
  { to: '/action-history', label: 'Action History', icon: Clock3 },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export default function Sidebar({ open, onClose, onLogout }) {
  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Đóng menu" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <NavLink to="/" onClick={onClose}>Hệ Thống IOT</NavLink>
          <button className="icon-button mobile-only" onClick={onClose} aria-label="Đóng menu"><X size={20} /></button>
        </div>
        <nav aria-label="Menu chính">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={18} /><span>Đăng xuất</span>
        </button>
      </aside>
    </>
  );
}
