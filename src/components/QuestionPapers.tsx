import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, subjectName } from '../api';
import type { Doc } from '../api';
import { stateOf } from '../pages/Documents';
import { Notice } from './Layout';

// A textbook's subject's public exam papers, on the book's own page: listed, and added with only
// the year to give (board, class and subject are the book's). A paper examines every volume of
// its subject, so each volume's page shows the same list; Volume 1's export carries them.
export function QuestionPapers({ book }: { book: Doc }) {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<Doc[] | null>(null);
  const [year, setYear] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // As the book is read: a scanned subject's papers are scans too, as a rule.
  const [fromImages, setFromImages] = useState(book.read_from_images);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tamil = book.board === 'STATE_TAMIL';

  useEffect(() => {
    api.documents()
      .then((docs) => setPapers(docs
        .filter((d) => d.document_type === 'QUESTION_PAPER' && d.board === book.board
          && d.class_level === book.class_level && d.subject === book.subject)
        .sort((a, b) => (b.exam_year ?? 0) - (a.exam_year ?? 0))))
      .catch((err: Error) => setError(err.message));
  }, [book.board, book.class_level, book.subject]);

  const taken = papers?.some((p) => String(p.exam_year) === year.trim());

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !/^\d{4}$/.test(year.trim())) return;
    const form = new FormData();
    form.append('file', file);
    form.append('title', file.name.replace(/\.pdf$/i, ''));
    form.append('subject', book.subject);
    form.append('board', book.board ?? '');
    form.append('class_level', book.class_level ?? '');
    form.append('document_type', 'QUESTION_PAPER');
    form.append('exam_year', year.trim());
    if (fromImages && !tamil) form.append('read_from_images', 'true');
    setBusy(true);
    setError(null);
    try {
      const paper = await api.upload(form);
      navigate(`/documents/${paper.id}`); // to read and classify it
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>Question papers</h3>
      <div className="muted small">
        {subjectName(book.subject)} · Class {book.class_level} · {book.board}
        {book.volume ? ': for every volume. They travel in Volume 1\'s export.' : '. They travel in this book\'s export.'}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {papers === null ? (
        <p className="muted small">Loading…</p>
      ) : papers.length === 0 ? (
        <p className="muted small">No question papers yet.</p>
      ) : (
        <ul className="papers">
          {papers.map((p) => {
            const state = stateOf(p);
            return (
              <li key={p.id} className="row spread">
                <Link to={`/documents/${p.id}`}><b>{p.exam_year}</b> · {p.title}</Link>
                <span className={`pill ${state.tone}`}>{state.label}</span>
              </li>
            );
          })}
        </ul>
      )}

      <form className="row" onSubmit={add}>
        <label className="field">
          Exam year
          <input inputMode="numeric" placeholder="2025" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 100 }} />
        </label>
        <label className="field">
          Paper (PDF)
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {!tamil && (
          <label className="row small">
            <input type="checkbox" checked={fromImages} onChange={(e) => setFromImages(e.target.checked)} />
            Read from page images (a scan)
          </label>
        )}
        <button className="btn" disabled={busy || !file || !/^\d{4}$/.test(year.trim())}>
          {busy ? 'Uploading…' : 'Add question paper'}
        </button>
      </form>
      {taken && <Notice tone="info">This subject already has a {year.trim()} paper. Adding another gives students two of that year.</Notice>}
    </div>
  );
}
