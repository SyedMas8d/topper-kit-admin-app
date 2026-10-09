import { useState } from 'react';
import { api } from '../api';

type LeftOut = { reason: string; image: string | null };
type Part = { part: string; questions: number; marks_each: number | null; answer_count: number | null };

// The classify report, as the server returns it: a book's (chapters, topics, exercises ...)
// or a paper's (parts, questions, links to the textbook).
export function Report({ result }: { result: Record<string, unknown> }) {
  return 'questions_by_kind' in result ? <PaperReport r={result} /> : <BookReport r={result} />;
}

function Kinds({ kinds }: { kinds: Record<string, number> }) {
  return (
    <table>
      <tbody>
        {Object.entries(kinds).map(([kind, count]) => (
          <tr key={kind}><td>{kind.replace(/_/g, ' ')}</td><td style={{ textAlign: 'right' }}><b>{count}</b></td></tr>
        ))}
      </tbody>
    </table>
  );
}

function BookReport({ r }: { r: Record<string, unknown> }) {
  const leftOut = (r.questions_left_out ?? {}) as Record<string, LeftOut>;
  const gaps = (r.exercise_gaps ?? {}) as Record<string, number[]>;
  const noHints = (r.chapters_without_hints ?? []) as number[];
  const renamed = (r.renamed_chapters ?? {}) as Record<string, string>;
  return (
    <div className="card stack">
      <h2>Classify report</h2>
      <div className="grid2">
        {(['chapters', 'topics', 'exercises', 'points_to_remember', 'solved_problems'] as const).map((k) => (
          <div className="stat" key={k}><b>{String(r[k] ?? 0)}</b><span className="small muted">{k.replace(/_/g, ' ')}</span></div>
        ))}
      </div>
      <div className="grid2">
        <div><h3>Questions by kind</h3><Kinds kinds={(r.exercises_by_kind ?? {}) as Record<string, number>} /></div>
        <div className="stack">
          <div>
            <h3>Worth a look</h3>
            <div className="small muted">Fix these before publishing, or accept them.</div>
          </div>
          <div className="small">Chapters without hints: {noHints.length ? noHints.join(', ') : 'none'}</div>
          <div className="small">Question numbers skipped: {Object.keys(gaps).length ? Object.entries(gaps).map(([s, n]) => `${s} (${n.join(', ')})`).join('; ') : 'none'}</div>
          {Object.keys(renamed).length > 0 && (
            <div className="small">Renamed chapters: {Object.values(renamed).join('; ')}</div>
          )}
        </div>
      </div>
      <div>
        <h3>Questions left out ({Object.keys(leftOut).length})</h3>
        <div className="small muted">Not shown to students: a question that could not be read safely, or a listening task.</div>
        {Object.keys(leftOut).length === 0 ? (
          <div className="small">None.</div>
        ) : (
          <table>
            <tbody>
              {Object.entries(leftOut).map(([id, item]) => (
                <tr key={id}>
                  <td style={{ whiteSpace: 'nowrap' }}><b>{id}</b></td>
                  <td>{item.reason}{item.image && <Crop path={item.image} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PaperReport({ r }: { r: Record<string, unknown> }) {
  const parts = (r.parts ?? []) as Part[];
  const unlinked = (r.without_chapter ?? []) as string[];
  const figures = (r.with_figure ?? []) as string[];
  return (
    <div className="card stack">
      <h2>Classify report</h2>
      <div className="grid2">
        <div className="stat"><b>{String(r.questions ?? 0)}</b><span className="small muted">questions</span></div>
        <div className="stat"><b>{parts.length}</b><span className="small muted">parts</span></div>
        <div className="stat"><b>{figures.length}</b><span className="small muted">with a figure</span></div>
        <div className="stat"><b>{r.textbook_id ? 'yes' : 'no'}</b><span className="small muted">linked to the textbook</span></div>
      </div>
      <div className="grid2">
        <div>
          <h3>Parts</h3>
          <table>
            <tbody>
              {parts.map((p) => (
                <tr key={p.part}>
                  <td>Part {p.part}</td>
                  <td>{p.questions} questions</td>
                  <td className="muted">{p.marks_each ? `${p.marks_each} marks each` : ''}{p.answer_count ? ` · answer ${p.answer_count}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div><h3>Questions by kind</h3><Kinds kinds={(r.questions_by_kind ?? {}) as Record<string, number>} /></div>
      </div>
      <div className="small">
        No chapter found for: {unlinked.length ? unlinked.join(', ') : 'none'}
        {!r.textbook_id && ' (classify and publish the textbook first, then classify this paper again)'}
      </div>
    </div>
  );
}

// A left-out question's crop, fetched with the admin key when asked for.
function Crop({ path }: { path: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (uri) return <div><img className="crop" src={uri} alt="The question as printed" /></div>;
  return (
    <div>
      <button className="btn soft small" style={{ marginTop: 6 }} onClick={() => api.crop(path).then((r) => setUri(r.data_uri)).catch((e: Error) => setError(e.message))}>
        Show as printed
      </button>
      {error && <span className="small" style={{ color: 'var(--red)' }}> {error}</span>}
    </div>
  );
}
