import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SUBJECTS } from '../api';
import { Notice } from '../components/Layout';

const BOARDS = ['STATE', 'CBSE', 'ICSE', 'STATE_TAMIL', 'NIOS'];
const CLASSES = Array.from({ length: 12 }, (_, i) => String(i + 1));

export function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('SCIENCE');
  const [board, setBoard] = useState('STATE');
  const [classLevel, setClassLevel] = useState('10');
  const [type, setType] = useState<'TEXTBOOK' | 'QUESTION_PAPER'>('TEXTBOOK');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('title', title.trim() || file.name.replace(/\.pdf$/i, ''));
    form.append('subject', subject);
    form.append('board', board);
    form.append('class_level', classLevel);
    form.append('document_type', type);
    if (type === 'QUESTION_PAPER') form.append('exam_year', year);
    setBusy(true);
    setError(null);
    try {
      const doc = await api.upload(form);
      navigate(`/documents/${doc.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Upload</h1>
      <form className="card stack" onSubmit={submit} style={{ maxWidth: 620 }}>
        <label className="field">
          PDF
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <div className="grid2">
          <label className="field">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as 'TEXTBOOK' | 'QUESTION_PAPER')}>
              <option value="TEXTBOOK">Textbook</option>
              <option value="QUESTION_PAPER">Question paper</option>
            </select>
          </label>
          {type === 'QUESTION_PAPER' && (
            <label className="field">
              Exam year
              <input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
          )}
          <label className="field">
            Subject
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {Object.entries(SUBJECTS).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
          <label className="field">
            Board
            <select value={board} onChange={(e) => setBoard(e.target.value)}>
              {BOARDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="field">
            Class
            <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)}>
              {CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          Title (shown to students)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'TEXTBOOK' ? 'e.g. Science Class 10' : 'e.g. Public Exam 2025'}
          />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="row">
          <button className="btn" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload'}</button>
          <span className="muted small">Next: process (textbooks), classify, check, publish.</span>
        </div>
      </form>
    </>
  );
}
