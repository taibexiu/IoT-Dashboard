import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ fullname: '', email: '', username: '', password: '' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try { await register({ ...form, fullname: form.fullname.trim(), email: form.email.trim(), username: form.username.trim() }); }
    catch (error) { setError(error.message); }
  }

  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }); }

  return (
    <main className="login-page">
      <section className="login-card panel">
        <div className="login-heading"><h1>Đăng ký tài khoản</h1></div>
        {error && <div className="error-message" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label htmlFor="fullname">Họ và tên</label>
          <input id="fullname" name="fullname" value={form.fullname} onChange={update} required pattern=".*\S.*" autoComplete="name" />
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={update} required autoComplete="email" />
          <label htmlFor="username">Username</label>
          <input id="username" name="username" value={form.username} onChange={update} required pattern=".*\S.*" autoComplete="username" />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" value={form.password} onChange={update} required autoComplete="new-password" />
          <button className="primary-button login-button" type="submit">Đăng ký</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 14 }}><Link to="/login">Đăng nhập</Link></p>
      </section>
    </main>
  );
}
