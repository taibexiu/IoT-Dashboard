import './Auth.css';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Đăng nhập · Hệ Thống IOT';
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card panel" aria-labelledby="login-title">
        <div className="login-heading"><h1 id="login-title">Hệ Thống IOT</h1></div>
        {error && <div className="error-message" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Nhập tên đăng nhập" required autoFocus maxLength={100} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Nhập mật khẩu" required maxLength={200} />
          <button type="submit" className="primary-button login-button">Đăng nhập</button>
        </form>
      </section>
    </main>
  );
}
