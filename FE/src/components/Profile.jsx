import { useAuth } from '../context/AuthContext';
import './Profile.css';

function ProfileLink({ value }) {
  let url;
  try { url = new URL(value); } catch { return <span className="muted">Chưa cập nhật</span>; }
  if (!['http:', 'https:'].includes(url.protocol)) return <span className="muted">Chưa cập nhật</span>;
  return <a href={value} target="_blank" rel="noopener noreferrer" title={value}>{value.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>;
}

export default function Profile() {
  const { user } = useAuth();

  return (
    <section className="profile-card panel" aria-labelledby="profile-title">
      <div className="profile-avatar" aria-hidden="true">{(user.username || user.fullname || 'A').charAt(0).toUpperCase()}</div>
      <h1 id="profile-title">{user.username === 'admin' ? 'Admin' : user.username}</h1>
      <p className="profile-subtitle">Hệ Thống IoT Cảm Biến</p>
      <dl className="profile-details">
        <div><dt>Họ và tên</dt><dd>{user.fullname || <span className="muted">Chưa cập nhật</span>}</dd></div>
        <div><dt>Email</dt><dd>{user.email || <span className="muted">Chưa cập nhật</span>}</dd></div>
        <div><dt>GitHub</dt><dd><ProfileLink value={user.github} /></dd></div>
        <div><dt>Postman</dt><dd><ProfileLink value={user.postman} /></dd></div>
        <div><dt>Figma</dt><dd><ProfileLink value={user.figma} /></dd></div>
        <div><dt>Báo cáo PDF</dt><dd><ProfileLink value={user.pdf} /></dd></div>
      </dl>
    </section>
  );
}
