import { NavLink, useNavigate } from 'react-router-dom';
import { session } from '../api';

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const logout = () => {
    session.clear();
    navigate('/login', { replace: true });
  };
  return (
    <>
      <header className="top">
        <div className="wrap">
          <NavLink to="/" className="brand">
            <img src="/brand-mark.png" alt="" />
            <span className="word">Topper<i>Kit</i></span>
            <span className="badge-admin">Admin</span>
          </NavLink>
          <nav>
            <NavLink to="/" end>Documents</NavLink>
            <NavLink to="/upload">Upload</NavLink>
            <NavLink to="/usage">Usage</NavLink>
          </nav>
          <span className="server">{session.server()}</span>
          <button className="btn amber" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: React.ReactNode }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}
