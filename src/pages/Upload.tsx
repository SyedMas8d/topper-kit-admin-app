import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SUBJECTS } from '../api';
import { Notice } from '../components/Layout';

const BOARDS = ['STATE', 'STATE_TAMIL', 'CBSE', 'ICSE', 'NIOS'];
const BOARD_LABELS: Record<string, string> = { STATE: 'State Board', STATE_TAMIL: 'State Board (Tamil)' };
// A subject named in the file ("10_state_english_book.pdf"), to suggest; never assumed.
const NAMED: [RegExp, string][] = [
  [/physics/i, 'PHYSICS'],
  [/english/i, 'ENGLISH'],
  [/math/i, 'MATHEMATICS'],
  [/social/i, 'SOCIAL_SCIENCE'],
  [/science/i, 'SCIENCE'],
];
const CLASSES = Array.from({ length: 12 }, (_, i) => String(i + 1));

export function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  // No default: an English book classified as Science is read with Science's rules.
  const [subject, setSubject] = useState('');
  const [board, setBoard] = useState('STATE');
  const [classLevel, setClassLevel] = useState('10');
  const [type, setType] = useState<'TEXTBOOK' | 'QUESTION_PAPER'>('TEXTBOOK');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  // Read from page images (paid, batch) instead of the PDF text: a Tamil-medium book always is;
  // otherwise a book whose PDF text scrambles its equations (Class 11 and 12 Physics).
  const [fromImages, setFromImages] = useState(false);
  // A textbook printed in volumes (Class 11 and 12 Physics): which one. '' for a single book.
  const [volume, setVolume] = useState('');
  const tamil = board === 'STATE_TAMIL';
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Physics's PDF text scrambles its equations: it is read from its page images unless unticked.
  function chooseSubject(next: string) {
    setSubject(next);
    setFromImages(next === 'PHYSICS');
  }

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
    if (type === 'TEXTBOOK' && fromImages && !tamil) form.append('read_from_images', 'true');
    if (type === 'TEXTBOOK' && volume) form.append('volume', volume);
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
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setFile(chosen);
              const named = chosen && NAMED.find(([pattern]) => pattern.test(chosen.name));
              if (named && !subject) chooseSubject(named[1]);
              // "Class_11_Physics_English_Volume_1_2024_Edition.pdf": its class and volume, to suggest.
              const classIn = chosen?.name.match(/class[_\s-]*(\d{1,2})/i);
              if (classIn && CLASSES.includes(classIn[1])) setClassLevel(classIn[1]);
              const volumeIn = chosen?.name.match(/vol(?:ume)?[_\s-]*(\d)/i);
              setVolume(volumeIn ? volumeIn[1] : '');
              if (chosen && /paper|exam|question/i.test(chosen.name)) setType('QUESTION_PAPER');
            }}
          />
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
            <select value={subject} onChange={(e) => chooseSubject(e.target.value)}>
              <option value="" disabled>Choose…</option>
              {Object.entries(SUBJECTS).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
          <label className="field">
            Board
            <select value={board} onChange={(e) => setBoard(e.target.value)}>
              {BOARDS.map((b) => <option key={b} value={b}>{BOARD_LABELS[b] ?? b}</option>)}
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
        {type === 'TEXTBOOK' && (
          <label className="field">
            Volume
            <select value={volume} onChange={(e) => setVolume(e.target.value)}>
              <option value="">— (a single book)</option>
              <option value="1">Volume 1</option>
              <option value="2">Volume 2</option>
            </select>
          </label>
        )}
        {type === 'TEXTBOOK' && (
          <label className="small" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={tamil || fromImages} disabled={tamil} onChange={(e) => setFromImages(e.target.checked)} />
            <span>
              <b>Read pages from images</b> (paid, about ₹0.28 a page): for a book whose PDF text scrambles its
              equations, such as Class 11 and 12 Physics.{tamil ? ' Tamil-medium books are always read this way.' : ''}
            </span>
          </label>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="row">
          <button className="btn" disabled={busy || !file || !subject}>{busy ? 'Uploading…' : 'Upload'}</button>
          <span className="muted small">Next: process (textbooks), classify, check, publish.</span>
        </div>
      </form>
    </>
  );
}
