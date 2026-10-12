import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Child, ParentsPage as Page } from '../api';
import { Notice } from '../components/Layout';

const PAGE_SIZE = 20;
const SIGN_IN = { google: 'Google', password: 'Password', both: 'Google + password' };

// Joined dates are shown as dates only: the server's clock may not be this browser's zone.
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Last seen is stored in UTC, so it can be shown as how long ago.
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const minutes = Math.round((Date.now() - new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime()) / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (60 * 24))} days ago`;
}

function ChildLine({ child }: { child: Child }) {
  return (
    <div className="row small" style={{ gap: 8 }}>
      <b>{child.name}</b>
      <span className="muted">{child.board} · Class {child.class_level}</span>
      {child.studying_now ? (
        <span className="pill live">Studying now</span>
      ) : (
        <span className="muted">last seen {ago(child.last_seen_at)}</span>
      )}
    </div>
  );
}

export function ParentsPage() {
  // The page and search live in the address, so a refresh or a shared link keeps them.
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .parents(page, PAGE_SIZE, q)
      .then((found) => {
        setData(found);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [page, q]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const go = (to: number, search = q) => setParams({ ...(search ? { q: search } : {}), ...(to > 1 ? { page: String(to) } : {}) });

  return (
    <>
      <div className="row spread">
        <h1>Parents</h1>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            go(1, draft.trim());
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search email or name" style={{ minWidth: 260 }} />
          <button className="btn">Search</button>
          {q && (
            <button
              type="button"
              className="btn soft"
              onClick={() => {
                setDraft('');
                go(1, '');
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card">
        {data === null ? (
          <div className="muted">Loading…</div>
        ) : data.parents.length === 0 ? (
          <div className="muted">{q ? `No parent matches “${q}”.` : 'No parents yet.'}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Parent</th>
                <th>Sign-in</th>
                <th>Joined</th>
                <th>Children</th>
              </tr>
            </thead>
            <tbody>
              {data.parents.map((parent) => (
                <tr key={parent.id}>
                  <td>
                    <div><b>{parent.name || '—'}</b></div>
                    <div className="small muted">
                      {parent.email} {!parent.email_verified && <span className="pill warn">not verified</span>}
                    </div>
                  </td>
                  <td className="small">{SIGN_IN[parent.sign_in]}</td>
                  <td className="small">{day(parent.created_at)}</td>
                  <td>
                    {parent.children.length === 0 ? (
                      <span className="small muted">No children yet</span>
                    ) : (
                      <div className="stack" style={{ gap: 6 }}>
                        {parent.children.map((child) => <ChildLine key={child.id} child={child} />)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && data.total > 0 && (
        <div className="row spread">
          <span className="small muted">
            {data.total} parent{data.total === 1 ? '' : 's'}{q ? ` matching “${q}”` : ''} · page {page} of {pages}
          </span>
          <div className="row">
            <button className="btn soft" disabled={page <= 1} onClick={() => go(page - 1)}>Previous</button>
            <button className="btn soft" disabled={page >= pages} onClick={() => go(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}
