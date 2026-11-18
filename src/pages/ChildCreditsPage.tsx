import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { ChildCredits, ClassChange, LedgerKind, LedgerPage } from '../api';
import { Notice } from '../components/Layout';

const ACTIONS: Record<string, string> = {
  question: 'Homework question',
  maths_question: 'Maths question',
  tamil_question: 'Tamil question',
  exercise: 'Exercise help',
  photo: 'Photo',
  download: 'Chapter PDF',
  audio: 'Audio summary',
  video: 'Video summary',
  switch: 'Change of class',
};
const SOURCES: Record<string, string> = { trial: 'Trial', order: 'Bought', admin: 'Given by admin' };
const FILTERS: { kind: LedgerKind; label: string }[] = [
  { kind: 'all', label: 'All' },
  { kind: 'grant', label: 'Credit' },
  { kind: 'spend', label: 'Debit' },
];
const utc = (iso: string) => new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
const day = (iso: string) => utc(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const when = (iso: string) => utc(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const n = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

// One child's credits: balance and pass, credits given by hand (a refund, goodwill), and the
// passbook 10 at a time, with the spends given back (shown to the admin only).
export function ChildCreditsPage() {
  const { id = '' } = useParams();
  const [child, setChild] = useState<ChildCredits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // bumped after a gift, to read everything again

  useEffect(() => {
    api
      .childCredits(id)
      .then((found) => {
        setChild(found);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [id, version]);

  return (
    <>
      <div className="row spread">
        <div>
          <Link to="/parents" className="small">← Parents</Link>
          <h1>{child ? `${child.name}'s credits` : 'Credits'}</h1>
          {child && (
            <div className="small muted">
              {child.board} · Class {child.class_level} · parent {child.parent_email}
              {child.student_code ? ` · Student ID ${child.student_code}` : ''}
              {child.has_pin ? ' · profile PIN on' : ''}
            </div>
          )}
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {child && (
        <div className="grid2">
          <div className="stat">
            <span className="small muted">Balance</span>
            <b>{n(child.balance)} <span className="small muted">of {n(Math.max(child.total, child.balance))}</span></b>
            {child.next_expiry && child.next_expiry_credits > 0 && (
              <span className="small muted">{n(child.next_expiry_credits)} last until {day(child.next_expiry)}</span>
            )}
          </div>
          <div className="stat">
            <span className="small muted">Still to come (later months of a pass)</span>
            <b>{n(child.upcoming)}</b>
          </div>
          <div className="stat">
            <span className="small muted">Pass</span>
            <b style={{ fontSize: 18 }}>{child.pass_name ?? 'None'}</b>
            {child.pass_until && <span className="small muted">until {day(child.pass_until)}</span>}
          </div>
        </div>
      )}
      {child && <Gift child={child} onGiven={() => setVersion((v) => v + 1)} />}
      <History id={id} version={version} />
      <ClassChanges id={id} version={version} />
      {child && <RemoveChild child={child} />}
    </>
  );
}

// Every change of board or class the parent made: one free a month, the rest charged.
function ClassChanges({ id, version }: { id: string; version: number }) {
  const [changes, setChanges] = useState<ClassChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .classChanges(id)
      .then(setChanges)
      .catch((err: Error) => setError(err.message));
  }, [id, version]);

  if (changes !== null && changes.length === 0) return null;
  return (
    <div className="card stack">
      <h3>Class changes</h3>
      {error && <Notice tone="error">{error}</Notice>}
      {changes === null ? (
        <div className="muted">Loading…</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>From</th>
              <th>To</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c, i) => (
              <tr key={`${c.created_at}-${i}`}>
                <td className="small">{when(c.created_at)}</td>
                <td>{c.from_board} · Class {c.from_class}</td>
                <td>{c.to_board} · Class {c.to_class}</td>
                <td>{c.credits > 0 ? n(c.credits) : <span className="pill">free</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// The app will not remove a child with paid credits or a pass left; support does it here when
// the parent asks (their right to have the child's data erased).
function RemoveChild({ child }: { child: ChildCredits }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loses = [
    child.balance + child.upcoming > 0 ? `${n(child.balance + child.upcoming)} credits` : null,
    child.pass_until ? `a pass until ${day(child.pass_until)}` : null,
  ].filter(Boolean);

  async function remove() {
    const typed = window.prompt(
      `Remove ${child.name}'s profile, progress and credits${loses.length ? ` (losing ${loses.join(' and ')})` : ''}? ` +
        `This cannot be undone. Payments stay on record.\n\nOnly when the parent (${child.parent_email}) asked for it. ` +
        `Type the child's name to confirm:`,
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== child.name.trim().toLowerCase()) {
      setError('The name did not match: nothing was removed.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.removeChild(child.student_id);
      navigate('/parents');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <h3>Remove this profile</h3>
      <div className="small muted">
        The app refuses while a child has paid credits or a pass, so none is lost by accident. Use this only when the
        parent asks support to remove the child anyway.
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <button className="btn danger" disabled={busy} onClick={remove}>Remove {child.name}</button>
      </div>
    </div>
  );
}

function Gift({ child, onGiven }: { child: ChildCredits; onGiven: () => void }) {
  const [credits, setCredits] = useState('');
  const [days, setDays] = useState('60');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const amount = Number(credits);
  const length = Number(days);
  const valid = amount > 0 && amount <= 10000 && Number.isInteger(length) && length >= 1 && length <= 365 && note.trim() !== '';

  async function give() {
    if (!window.confirm(`Give ${child.name} ${n(amount)} credits, lasting ${length} days?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.gift(child.student_id, amount, length, note.trim());
      setNotice(`${n(amount)} credits given to ${child.name}.`);
      setCredits('');
      setNote('');
      onGiven();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <h3>Give credits</h3>
      <div className="small muted">A refund, or goodwill. The parent sees it in the history as “From TopperKit” with your note.</div>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}
      <div className="row" style={{ alignItems: 'end' }}>
        <label className="field">Credits<input value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="decimal" style={{ width: 110 }} /></label>
        <label className="field">Lasts (days)<input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" style={{ width: 110 }} /></label>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Refund for a failed answer" />
        </label>
        <button className="btn" disabled={!valid || busy} onClick={give}>Give</button>
      </div>
    </div>
  );
}

function History({ id, version }: { id: string; version: number }) {
  const [kind, setKind] = useState<LedgerKind>('all');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [index, setIndex] = useState(0);
  // The page shown, with what it was read for: anything else is still loading.
  const [loaded, setLoaded] = useState<{ key: string; page?: LedgerPage; error?: string } | null>(null);
  const key = `${id}|${kind}|${index}|${cursors[index] ?? ''}|${version}`;
  const page = loaded?.key === key ? (loaded.page ?? null) : null;
  const error = loaded?.key === key ? (loaded.error ?? null) : null;

  useEffect(() => {
    let current = true;
    const asked = `${id}|${kind}|${index}|${cursors[index] ?? ''}|${version}`;
    api
      .childHistory(id, kind, cursors[index])
      .then((found) => current && setLoaded({ key: asked, page: found }))
      .catch((err: Error) => current && setLoaded({ key: asked, error: err.message }));
    return () => {
      current = false;
    };
  }, [id, kind, cursors, index, version]);

  function filter(next: LedgerKind) {
    setKind(next);
    setCursors([null]);
    setIndex(0);
  }

  return (
    <div className="card stack">
      <div className="row spread">
        <h3>History</h3>
        <div className="row" style={{ gap: 6 }}>
          {FILTERS.map((f) => (
            <button key={f.kind} className={`btn ${f.kind === kind ? '' : 'soft'}`} onClick={() => filter(f.kind)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {page === null ? (
        <div className="muted">Loading…</div>
      ) : page.entries.length === 0 ? (
        <div className="muted">Nothing here.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Credits</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {page.entries.map((entry, i) => {
              const added = entry.kind === 'grant';
              return (
                <tr key={`${entry.at}-${i}`} style={entry.refunded ? { opacity: 0.55 } : undefined}>
                  <td className="small">{added ? day(entry.at) : when(entry.at)}</td>
                  <td>
                    <b>{added ? entry.note || SOURCES[entry.source ?? ''] || 'Added' : ACTIONS[entry.action ?? ''] ?? entry.action}</b>
                    {added && (
                      <div className="small muted">
                        {SOURCES[entry.source ?? ''] ?? entry.source}
                        {entry.expires ? ` · lasts until ${day(entry.expires)}` : ''}
                        {entry.remaining !== null && entry.remaining !== undefined ? ` · ${n(entry.remaining)} left` : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <b style={{ color: added ? 'var(--green)' : 'var(--ink)' }}>
                      {added ? '+' : '−'}
                      {n(entry.credits)}
                    </b>
                  </td>
                  <td>{entry.refunded && <span className="pill hidden" title="Nothing was charged: no model was needed, or the answer failed">given back</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {(index > 0 || page?.next_cursor) && (
        <div className="row spread">
          <span className="small muted">Page {index + 1}</span>
          <div className="row">
            <button className="btn soft" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
            <button
              className="btn soft"
              disabled={!page?.next_cursor}
              onClick={() => {
                setCursors([...cursors.slice(0, index + 1), page!.next_cursor]);
                setIndex(index + 1);
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
