import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SERVERS, session } from '../api';
import { Notice } from '../components/Layout';

// The admin key is the only login: it is checked against the server before it is kept, and
// kept for this browser tab only.
export function Login() {
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [server, setServer] = useState(SERVERS.production);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.check(key.trim(), server);
      session.save(key.trim(), server);
      navigate('/', { replace: true });
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(status === 403 ? 'That admin key was not accepted.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login card stack">
      <div className="row">
        <img src="/brand-mark.png" alt="" width={48} height={48} style={{ borderRadius: 12 }} />
        <div>
          <h1 style={{ color: 'var(--indigo)' }}>TopperKit Admin</h1>
          <div className="muted small">Books, papers and usage.</div>
        </div>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Server
          <select value={server} onChange={(e) => setServer(e.target.value)}>
            <option value={SERVERS.production}>Production · {SERVERS.production}</option>
            <option value={SERVERS.local}>Local · {SERVERS.local}</option>
          </select>
        </label>
        <label className="field">
          Admin key
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoFocus autoComplete="off" />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn" disabled={busy || !key.trim()}>{busy ? 'Checking…' : 'Log in'}</button>
        <div className="muted small">Kept for this browser tab only: closing it logs you out.</div>
      </form>
    </div>
  );
}
