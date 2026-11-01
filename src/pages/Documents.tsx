import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, subjectName } from '../api';
import type { BookSummary, Doc, ImportWaiting } from '../api';
import { Notice } from '../components/Layout';

export function stateOf(doc: Doc): { label: string; tone: string } {
  if (doc.published_at) return { label: 'Published', tone: 'live' };
  if (doc.status === 'FAILED') return { label: 'Failed', tone: 'bad' };
  if (doc.status === 'PROCESSING') return { label: 'Processing…', tone: 'warn' };
  if (doc.status === 'COMPLETED') return { label: 'Not published', tone: 'hidden' };
  return { label: 'Uploaded', tone: 'warn' };
}

const describe = (b: BookSummary) =>
  `${subjectName(b.subject ?? '')} · ${b.board ?? '–'} · Class ${b.class_level ?? '–'}${b.volume ? ` · Vol ${b.volume}` : ''}, "${b.title}"`;

// What an import would meet on this server, as the question to confirm; null: nothing to ask.
function question(waiting: ImportWaiting): string | null {
  // A first volume's export brings its subject's question papers.
  const papers = waiting.papers ?? [];
  const years = (list: typeof papers) => list.map((p) => p.exam_year ?? '?').join(', ');
  const twice = papers.filter((p) => !p.same_id && p.same_year);
  const about = (papers.length ? `\n\nIt also brings ${papers.length} question paper${papers.length === 1 ? '' : 's'} (${years(papers)}); any already here are replaced.` : '')
    + (twice.length ? `\n\nThis server already has a ${years(twice)} paper of this subject from elsewhere: importing adds a second one of that year.` : '');
  if (waiting.same_id) {
    return `${describe(waiting.same_id)} is already on this server${waiting.same_id.published ? ' and published' : ''}.\n\n`
      + 'Replace it with this export? Its chapters, questions, answer keys and search passages are replaced, '
      + 'and it stays unpublished until you publish it again. Students\' progress is kept.' + about;
  }
  if (waiting.same_book) {
    return `This server already has ${describe(waiting.same_book)}.\n\n`
      + `Import ${describe(waiting.document)} as well? Students would then see two of the same book.` + about;
  }
  return twice.length ? `Import ${describe(waiting.document)}?` + about : null;
}

export function Documents() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  // Upload the bundle (nothing changes yet), confirm if the server has it or one like it, import.
  async function importBook(file: File) {
    setError(null);
    try {
      setImporting(`Uploading ${file.name}…`);
      const waiting = await api.receiveBook(file);
      const ask = question(waiting);
      if (ask && !window.confirm(ask)) return;
      setImporting(`Importing "${waiting.document.title}"…`);
      const done = await api.importBook(waiting.token);
      if (done.links_waiting) {
        window.alert(`Imported, with ${done.papers} question paper${done.papers === 1 ? '' : 's'}. Their questions from the other `
          + 'volume are linked when you import that volume too.');
      }
      navigate(`/documents/${done.document_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(null);
      if (picker.current) picker.current.value = '';
    }
  }

  useEffect(() => {
    api.documents().then(setDocs).catch((err: Error) => setError(err.message));
  }, []);

  const sorted = [...(docs ?? [])].sort(
    (a, b) => a.subject.localeCompare(b.subject) || a.document_type.localeCompare(b.document_type) || (a.exam_year ?? 0) - (b.exam_year ?? 0),
  );

  return (
    <>
      <div className="row spread">
        <h1>Documents</h1>
        <div className="row">
          {/* A book exported from another server (its "Export book" button), whole. */}
          <input ref={picker} type="file" accept=".zip" hidden onChange={(e) => e.target.files?.[0] && importBook(e.target.files[0])} />
          <button className="btn soft" disabled={importing !== null} onClick={() => picker.current?.click()}>
            {importing ?? 'Import a book'}
          </button>
          <Link to="/upload" className="btn amber" style={{ textDecoration: 'none' }}>Upload a book or paper</Link>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card">
        {docs === null ? (
          <div className="muted">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="muted">No documents yet. Upload a textbook to begin.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Title</th><th>Subject</th><th>Type</th><th>Board · Class</th><th>Pages</th><th>State</th></tr>
            </thead>
            <tbody>
              {sorted.map((doc) => {
                const state = stateOf(doc);
                return (
                  <tr key={doc.id} className="click" onClick={() => navigate(`/documents/${doc.id}`)}>
                    <td><b>{doc.title}</b>{doc.volume ? <span className="muted"> · Vol {doc.volume}</span> : null}<div className="muted small">{doc.filename}</div></td>
                    <td>{subjectName(doc.subject)}</td>
                    <td>{doc.document_type === 'QUESTION_PAPER' ? `Paper ${doc.exam_year ?? ''}` : 'Textbook'}</td>
                    <td>{doc.board ?? '–'} · {doc.class_level ?? '–'}</td>
                    <td>{doc.page_count ?? '–'}</td>
                    <td><span className={`pill ${state.tone}`}>{state.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
