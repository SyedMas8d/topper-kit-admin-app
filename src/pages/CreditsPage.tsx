import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { CreditPlan, CreditSettings, OrdersPage } from '../api';
import { Notice } from '../components/Layout';

// Credits: what each action costs and the trial (Settings), what parents can buy (Plans), and what
// they bought (Orders). A change applies from the next action or order; orders already made keep
// the price they were made at.

type Tab = 'settings' | 'plans' | 'orders';
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'settings', label: 'Settings' },
  { tab: 'plans', label: 'Plans' },
  { tab: 'orders', label: 'Orders' },
];

export function CreditsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.tab === params.get('tab'))?.tab ?? 'settings') as Tab;
  return (
    <>
      <div className="row spread">
        <h1>Credits</h1>
        <div className="row">
          {TABS.map((t) => (
            <button key={t.tab} className={`btn ${t.tab === tab ? '' : 'soft'}`} onClick={() => setParams({ tab: t.tab })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'settings' && <Settings />}
      {tab === 'plans' && <Plans />}
      {tab === 'orders' && <Orders />}
    </>
  );
}

// ---- Settings ------------------------------------------------------------------------------------

// unit: 'credits' are stored as tenths (0.5 credit is 5); 'days' as they are.
const FIELDS: { key: string; label: string; help: string; unit: 'credits' | 'days' }[] = [
  { key: 'cost_question', label: 'Homework question', help: 'Each question to the tutor (not Mathematics).', unit: 'credits' },
  { key: 'cost_maths_question', label: 'Maths question or worked answer', help: 'The Maths tutor, and Show me how on a Maths exercise (a stronger model).', unit: 'credits' },
  { key: 'cost_exercise', label: 'Exercise help', help: 'Show me how, or checking a written answer. Checking against the book’s key is always free.', unit: 'credits' },
  { key: 'cost_photo', label: 'Photo or picture', help: 'Reading a photo, or a picture asked about.', unit: 'credits' },
  { key: 'cost_download', label: 'Chapter PDF', help: 'The same chapter again within a day is free.', unit: 'credits' },
  { key: 'trial_units', label: 'Trial credits', help: 'Given to each new child, once.', unit: 'credits' },
  { key: 'trial_days', label: 'Trial lasts', help: 'Days the trial credits can be used.', unit: 'days' },
  { key: 'validity_days', label: 'Credits last', help: 'Days each month’s or top-up’s credits can be used (unused ones carry over until then).', unit: 'days' },
  { key: 'period_days', label: 'Pass month', help: 'Days between a 3- or 6-month pass’s monthly credits.', unit: 'days' },
];

const shown = (key: string, value: number) => (FIELDS.find((f) => f.key === key)?.unit === 'credits' ? value / 10 : value);

function Settings() {
  const [saved, setSaved] = useState<CreditSettings | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const take = useCallback((values: CreditSettings) => {
    setSaved(values);
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(shown(f.key, values[f.key] ?? 0))])));
  }, []);

  useEffect(() => {
    api.creditSettings().then(({ values }) => take(values)).catch((err: Error) => setError(err.message));
  }, [take]);

  if (!saved) return error ? <Notice tone="error">{error}</Notice> : <div className="card muted">Loading…</div>;

  // Only what changed is sent; credits go back to tenths.
  const changes: CreditSettings = {};
  let invalid: string | null = null;
  for (const field of FIELDS) {
    const text = draft[field.key]?.trim() ?? '';
    const number = Number(text);
    const value = field.unit === 'credits' ? Math.round(number * 10) : number;
    if (text === '' || !Number.isFinite(number) || number < 0 || (field.unit === 'days' && !Number.isInteger(number))) {
      invalid = `${field.label}: ${field.unit === 'days' ? 'a whole number of days' : 'a number of credits, such as 0.5'}.`;
    } else if (field.unit === 'credits' && Math.abs(number * 10 - value) > 1e-9) {
      invalid = `${field.label}: credits go in steps of 0.1.`;
    } else if (value !== saved[field.key]) {
      changes[field.key] = value;
    }
  }
  const dirty = Object.keys(changes).length > 0;

  async function save(values: CreditSettings, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      take((await api.saveCreditSettings(values)).values);
      setNotice(message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    const on = saved!.credits_on === 1;
    const sure = window.confirm(
      on
        ? 'Turn charging off? Every paid feature opens for every child and nothing is charged, until you turn it on again.'
        : 'Turn charging on? Paid features need credits again.',
    );
    if (sure) await save({ credits_on: on ? 0 : 1 }, on ? 'Charging is off: everything is open.' : 'Charging is on.');
  }

  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}
      <div className="card row spread">
        <div>
          <h3>Charging {saved.credits_on === 1 ? <span className="pill live">On</span> : <span className="pill bad">Off</span>}</h3>
          <div className="small muted">
            Off opens every paid feature for every child and charges nothing. For an emergency, such as the credits store
            being down.
          </div>
        </div>
        <button className={`btn ${saved.credits_on === 1 ? 'danger' : ''}`} onClick={toggle} disabled={busy}>
          {saved.credits_on === 1 ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      <div className="card stack">
        <div className="grid2">
          {FIELDS.map((field) => (
            <label key={field.key} className="field">
              {field.label} ({field.unit})
              <input
                inputMode="decimal"
                value={draft[field.key] ?? ''}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              />
              <span className="small muted" style={{ fontWeight: 500 }}>{field.help}</span>
            </label>
          ))}
        </div>
        {invalid && <Notice tone="error">{invalid}</Notice>}
        <div className="row">
          <button className="btn" disabled={!dirty || !!invalid || busy} onClick={() => save(changes, 'Saved. It applies from the next action.')}>
            Save changes
          </button>
          {dirty && (
            <button className="btn soft" onClick={() => take(saved)} disabled={busy}>
              Undo
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ---- Plans -----------------------------------------------------------------------------------------

const AUDIENCE = { normal: 'One child', family: 'Family (2+ children, each)', any: 'Anyone' };

function PlanRow({ plan, onSaved }: { plan: CreditPlan; onSaved: (plan: CreditPlan, message: string) => void }) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price_rupees));
  const [credits, setCredits] = useState(String(plan.credits_per_month));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceN = Number(price);
  const creditsN = Number(credits);
  const valid = name.trim() !== '' && Number.isFinite(priceN) && priceN >= 0 && Number.isFinite(creditsN) && creditsN >= 0;
  const dirty = name.trim() !== plan.name || priceN !== plan.price_rupees || creditsN !== plan.credits_per_month;

  async function save(change: Parameters<typeof api.savePlan>[1], message: string) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.savePlan(plan.code, change), message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr style={plan.active ? undefined : { opacity: 0.6 }}>
      <td>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        <div className="small muted">{plan.code}</div>
        {error && <div className="small" style={{ color: 'var(--red)' }}>{error}</div>}
      </td>
      <td className="small">{AUDIENCE[plan.audience]}</td>
      <td className="small">{plan.plan_group === 'topup' ? 'Once' : `${plan.months} month${plan.months === 1 ? '' : 's'}`}</td>
      <td><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" style={{ width: 90 }} /></td>
      <td><input value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="decimal" style={{ width: 90 }} /></td>
      <td>{plan.active ? <span className="pill live">On sale</span> : <span className="pill hidden">Off sale</span>}</td>
      <td>
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <button
            className="btn"
            disabled={!dirty || !valid || busy}
            onClick={() => save({ name: name.trim(), price_rupees: priceN, credits_per_month: creditsN }, `${name.trim()} saved.`)}
          >
            Save
          </button>
          <button
            className="btn soft"
            disabled={busy}
            onClick={() => {
              if (window.confirm(plan.active ? `Take “${plan.name}” off sale? Parents will not see it.` : `Put “${plan.name}” on sale?`)) {
                save({ active: !plan.active }, plan.active ? `${plan.name} is off sale.` : `${plan.name} is on sale.`);
              }
            }}
          >
            {plan.active ? 'Off sale' : 'On sale'}
          </button>
        </div>
      </td>
    </tr>
  );
}

function Plans() {
  const [plans, setPlans] = useState<CreditPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.creditPlans().then(setPlans).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}
      <Notice tone="info">
        A pass gives its credits every month; a 3-month pass gives them three times. The family price applies to each child when
        an order has passes for two or more children. Changes apply to new orders; orders already made keep their price.
      </Notice>
      <div className="card">
        {plans === null ? (
          <div className="muted">Loading…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>For</th>
                <th>Length</th>
                <th>Price (₹)</th>
                <th>Credits / month</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <PlanRow
                  key={`${plan.code}-${plan.price_rupees}-${plan.credits_per_month}-${plan.name}-${plan.active}`}
                  plan={plan}
                  onSaved={(changed, message) => {
                    setPlans(plans.map((p) => (p.code === changed.code ? changed : p)));
                    setNotice(message);
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ---- Orders ----------------------------------------------------------------------------------------

const PAGE_SIZE = 20;
const STATUS_PILL = { paid: 'live', pending: 'warn', failed: 'bad' } as const;
const when = (iso: string) =>
  new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function Orders() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrdersPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api
      .creditOrders(page, PAGE_SIZE, status, q)
      .then((found) => {
        if (!current) return;
        setData(found);
        setError(null);
      })
      .catch((err: Error) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [page, status, q]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <div className="row spread">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(draft.trim());
            setPage(1);
          }}
        >
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All orders</option>
            <option value="paid">Paid</option>
            <option value="pending">Waiting for payment</option>
            <option value="failed">Failed</option>
          </select>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Parent's email" style={{ minWidth: 240 }} />
          <button className="btn">Search</button>
          {q && (
            <button
              type="button"
              className="btn soft"
              onClick={() => {
                setDraft('');
                setQ('');
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </form>
        {data && (
          <div className="stat" style={{ padding: '8px 16px' }}>
            <span className="small muted">Paid{q || status ? ' (matching)' : ''}</span>
            <b>{rupees(data.paid_rupees)}</b>
          </div>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card">
        {data === null ? (
          <div className="muted">Loading…</div>
        ) : data.orders.length === 0 ? (
          <div className="muted">No orders{q || status ? ' match' : ' yet'}.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Parent</th>
                <th>Bought</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.id}>
                  <td className="small">{when(order.created_at)}</td>
                  <td className="small">{order.parent_email}</td>
                  <td>
                    <div className="stack" style={{ gap: 2 }}>
                      {order.lines.map((line, i) => (
                        <div key={i} className="small">
                          {line.student_id.startsWith('00000000') ? (
                            <b>{line.student_name}</b>
                          ) : (
                            <Link to={`/credits/children/${line.student_id}`}><b>{line.student_name}</b></Link>
                          )}{' '}
                          · {line.plan_name} · {rupees(line.price_rupees)}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td><b>{rupees(order.total_rupees)}</b></td>
                  <td>
                    <span className={`pill ${STATUS_PILL[order.status]}`}>{order.status === 'pending' ? 'waiting' : order.status}</span>
                    {order.status === 'paid' && !order.credits_given && (
                      <div className="small" style={{ color: 'var(--red)' }}>credits not given yet</div>
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
            {data.total} order{data.total === 1 ? '' : 's'} · page {page} of {pages}
          </span>
          <div className="row">
            <button className="btn soft" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn soft" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </>
  );
}
