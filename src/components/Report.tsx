import { useState } from 'react';
import { api } from '../api';
import type { ManualQuestion } from '../api';

type LeftOut = { reason: string; image: string | null };
type Part = { part: string; questions: number; marks_each: number | null; answer_count: number | null };

// The classify report, as the server returns it: a book's (chapters, topics, exercises ...)
// or a paper's (parts, questions, links to the textbook).
type Props = { result: Record<string, unknown>; documentId: string; onChange: (result: Record<string, unknown>) => void };

export function Report({ result, documentId, onChange }: Props) {
  return 'questions_by_kind' in result
    ? <PaperReport r={result} />
    : <BookReport r={result} documentId={documentId} onChange={onChange} />;
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

function BookReport({ r, documentId, onChange }: { r: Record<string, unknown>; documentId: string; onChange: Props['onChange'] }) {
  const leftOut = (r.questions_left_out ?? {}) as Record<string, LeftOut>;
  const added = (r.added_by_hand ?? {}) as Record<string, string>;
  const accepted = (r.accepted_left_out ?? {}) as Record<string, LeftOut>;
  const notNeeded = (r.manual_not_needed ?? {}) as Record<string, string>;
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(run: () => Promise<Record<string, unknown>>) {
    setError(null);
    try {
      onChange(await run());
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const undo = (id: string) => act(() => api.deleteManualQuestion(documentId, id));
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
                  <td>
                    {item.reason}
                    {item.image && <Crop path={item.image} />}
                    {editing === id ? (
                      <FixForm
                        reason={item.reason}
                        onCancel={() => setEditing(null)}
                        onSave={(body) => act(() => api.saveManualQuestion(documentId, id, body))}
                      />
                    ) : (
                      <div className="row" style={{ marginTop: 6, gap: 8 }}>
                        <button className="btn small" onClick={() => setEditing(id)}>Fix and add</button>
                        <button className="btn soft small" onClick={() => act(() => api.saveManualQuestion(documentId, id, { action: 'accept' }))}>
                          Accept: leave it out
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error && <div className="small" style={{ color: 'var(--red)' }}>{error}</div>}
      </div>
      {(Object.keys(added).length > 0 || Object.keys(accepted).length > 0) && (
        <div>
          <h3>Dealt with by hand ({Object.keys(added).length + Object.keys(accepted).length})</h3>
          <div className="small muted">Kept after every classify. Delete a fix to leave the question out again.</div>
          <table>
            <tbody>
              {Object.entries(added).map(([id, what]) => (
                <tr key={id}>
                  <td style={{ whiteSpace: 'nowrap' }}><b>{id}</b></td>
                  <td>Added by hand ({what.replace(/_/g, ' ').replace(' · added by hand', '')}){notNeeded[id] && <span className="muted"> · {notNeeded[id]}</span>}</td>
                  <td><button className="btn soft small" onClick={() => undo(id)}>Delete fix</button></td>
                </tr>
              ))}
              {Object.entries(accepted).map(([id, item]) => (
                <tr key={id}>
                  <td style={{ whiteSpace: 'nowrap' }}><b>{id}</b></td>
                  <td className="muted">Accepted as left out: {item.reason}</td>
                  <td><button className="btn soft small" onClick={() => undo(id)}>Delete fix</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

const KINDS: [string, string][] = [
  ['mcq', 'Multiple choice'], ['assertion_reason', 'Assertion and reason'], ['fill_blank', 'Fill in the blank'],
  ['true_false', 'True or false'], ['short_answer', 'Short answer'], ['long_answer', 'Long answer'],
  ['numerical', 'Numerical'], ['hots', 'HOTS'], ['writing', 'Writing task'], ['problem', 'Maths problem'],
];
const WITH_CHOICES = new Set(['mcq', 'assertion_reason']);
const KEYED = new Set(['mcq', 'assertion_reason', 'fill_blank', 'true_false', 'numerical']);
const ANSWER_HINT: Record<string, string> = {
  mcq: 'the right choice\'s letter: c', assertion_reason: 'the right choice\'s letter: a',
  fill_blank: 'the missing word(s), commas between', true_false: 'true or false', numerical: 'a number and its unit: 9.8 m/s²',
};

// A left-out question written out by hand from its crop: its kind, words, choices and, for an
// objective one, its answer (left empty, the answer is worked out and checked as for any other).
function FixForm({ reason, onSave, onCancel }: { reason: string; onSave: (q: ManualQuestion) => void; onCancel: () => void }) {
  const listening = /listening/i.test(reason);
  const [kind, setKind] = useState(listening ? 'short_answer' : 'mcq');
  const [text, setText] = useState('');
  const [choices, setChoices] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState('');
  const [passage, setPassage] = useState('');
  return (
    <div className="card stack" style={{ marginTop: 8 }}>
      <label className="field">
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </label>
      <label className="field">
        The question, as printed
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {WITH_CHOICES.has(kind) && choices.map((choice, i) => (
        <label className="field" key={i}>
          Choice {'abcd'[i]}
          <input value={choice} onChange={(e) => setChoices(choices.map((c, j) => (j === i ? e.target.value : c)))} />
        </label>
      ))}
      {KEYED.has(kind) && (
        <label className="field">
          Answer (optional: {ANSWER_HINT[kind]})
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </label>
      )}
      {listening && (
        <label className="field">
          The passage the student listens to (read aloud by the phone)
          <textarea rows={5} value={passage} onChange={(e) => setPassage(e.target.value)} />
        </label>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn small" onClick={() => onSave({
          action: 'add', kind, text, answer: answer || undefined, passage: passage || undefined,
          options: WITH_CHOICES.has(kind) ? choices.map((c, i) => ({ label: 'abcd'[i], text: c })) : [],
        })}>Save and add</button>
        <button className="btn soft small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
