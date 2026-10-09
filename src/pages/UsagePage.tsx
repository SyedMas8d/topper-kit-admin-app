import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Usage, UsageRow } from '../api';
import { Notice } from '../components/Layout';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function UsagePage() {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.usage(from, to).then(setUsage).catch((err: Error) => setError(err.message));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const money = (row: UsageRow) =>
    row.estimated_cost === null ? '–' : `${usage?.currency ?? ''} ${row.estimated_cost.toFixed(4)}`;
  const tokens = (n: number) => n.toLocaleString();

  return (
    <>
      <div className="row spread">
        <h1>Usage</h1>
        <div className="row">
          <label className="field">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {usage && (
        <>
          <div className="grid2">
            <div className="stat"><b>{usage.total.calls}</b><span className="small muted">model calls</span></div>
            <div className="stat"><b>{tokens(usage.total.input_tokens + usage.total.output_tokens)}</b><span className="small muted">tokens</span></div>
            <div className="stat"><b>{money(usage.total)}</b><span className="small muted">estimated cost</span></div>
          </div>
          {usage.total.estimated_cost === null && (
            <Notice tone="info">Some calls have no price: set LLM_PRICES in the server's .env to see the cost in money.</Notice>
          )}
          <div className="card">
            <h2>By purpose</h2>
            <table>
              <thead><tr><th>What for</th><th>Calls</th><th>Tokens in</th><th>Tokens out</th><th>Cost</th></tr></thead>
              <tbody>
                {Object.entries(usage.by_purpose).map(([key, row]) => (
                  <tr key={key}><td>{row.label ?? key}</td><td>{row.calls}</td><td>{tokens(row.input_tokens)}</td><td>{tokens(row.output_tokens)}</td><td>{money(row)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2>By day</h2>
            <table>
              <thead><tr><th>Day</th><th>Calls</th><th>Tokens</th><th>Cost</th></tr></thead>
              <tbody>
                {Object.entries(usage.by_day).map(([day, row]) => (
                  <tr key={day}><td>{day}</td><td>{row.calls}</td><td>{tokens(row.input_tokens + row.output_tokens)}</td><td>{money(row)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
