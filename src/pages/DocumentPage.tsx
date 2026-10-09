import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, subjectName } from '../api';
import type { Doc, Job } from '../api';
import { Notice } from '../components/Layout';
import { Report } from '../components/Report';
import { stateOf } from './Documents';

const POLL_MS = 3000;

// How long a finished job took. Both times are the database's own clock, which may not be this
// browser's time zone, so only their difference is shown.
function took(from: string, to: string) {
  const s = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function DocumentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [found, jobs] = await Promise.all([api.document(id), api.jobs(id)]);
      setDoc(found);
      setJob(jobs[0] ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // While classify runs in the background, ask how it is going.
  useEffect(() => {
    if (job?.status !== 'running') return;
    const timer = setInterval(async () => {
      const latest = await api.job(job.id).catch(() => null);
      if (latest) {
        setJob(latest);
        if (latest.status !== 'running') load();
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [job, load]);

  async function act(name: string, run: () => Promise<unknown>, done?: string) {
    setBusy(name);
    setError(null);
    setNote(null);
    try {
      await run();
      if (done) setNote(done);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!doc) return error ? <Notice tone="error">{error}</Notice> : <div className="muted">Loading…</div>;

  const paper = doc.document_type === 'QUESTION_PAPER';
  const processed = paper || doc.status === 'COMPLETED' || (doc.chunk_count ?? 0) > 0;
  const classified = job?.status === 'done';
  const running = job?.status === 'running';
  const published = Boolean(doc.published_at);
  const state = stateOf(doc);

  async function clear() {
    const typed = window.prompt(
      `Delete “${doc!.title}” and everything made from it (chapters, questions, crops, students' progress in it)? ` +
        'This cannot be undone. Type DELETE to confirm.',
    );
    if (typed !== 'DELETE') return;
    await act('clear', () => api.clear(doc!.id));
    navigate('/', { replace: true });
  }

  return (
    <>
      <div className="row spread">
        <div>
          <h1>{doc.title}</h1>
          <div className="muted">
            {subjectName(doc.subject)} · {paper ? `Question paper ${doc.exam_year}` : 'Textbook'} · {doc.board} · Class {doc.class_level}
            {doc.page_count ? ` · ${doc.page_count} pages` : ''}
          </div>
        </div>
        <span className={`pill ${state.tone}`}>{state.label}</span>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="ok">{note}</Notice>}

      <div className="steps">
        {!paper && (
          <div className={`step ${processed ? 'done' : ''}`}>
            <span className="n">1 · Process</span>
            <span className="small muted">Reads the PDF into searchable pages for the tutor.</span>
            {processed ? (
              <span className="small">✓ {doc.chunk_count} passages</span>
            ) : (
              <button className="btn" disabled={busy !== null} onClick={() => act('process', () => api.process(doc.id), 'Processed.')}>
                {busy === 'process' ? 'Processing… (a minute or two)' : 'Process'}
              </button>
            )}
          </div>
        )}
        <div className={`step ${classified ? 'done' : ''}`}>
          <span className="n">{paper ? '1' : '2'} · Classify</span>
          <span className="small muted">
            {paper ? 'Parts, questions, crops, links to the textbook.' : 'Chapters, topics, questions, revision cards.'}
          </span>
          {running ? (
            <span className="small">⏳ Classifying… this page checks every few seconds. The Mathematics book takes about 10 minutes.</span>
          ) : (
            <button className="btn" disabled={busy !== null || !processed} onClick={() => act('classify', async () => setJob(await api.classify(doc)))}>
              {classified ? 'Classify again' : 'Classify'}
            </button>
          )}
          {job?.status === 'failed' && <span className="small" style={{ color: 'var(--red)' }}>{job.error}</span>}
          {classified && job!.finished_at && <span className="small">✓ in {took(job!.started_at, job!.finished_at)}</span>}
        </div>
        <div className={`step ${published ? 'done' : ''}`}>
          <span className="n">{paper ? '2' : '3'} · Publish</span>
          <span className="small muted">Students see it only once published. Check the report first.</span>
          {published ? (
            <button className="btn soft" disabled={busy !== null} onClick={() => act('unpublish', async () => {
              const out = await api.unpublish(doc.id);
              if (out.also_unpublished.length) setNote(`Unpublished, with its papers: ${out.also_unpublished.join(', ')}.`);
            })}>
              Unpublish
            </button>
          ) : (
            <button className="btn amber" disabled={busy !== null || running} onClick={() => act('publish', () => api.publish(doc.id), 'Published: students can see it now.')}>
              Publish
            </button>
          )}
        </div>
      </div>

      {job?.result && <Report result={job.result} />}

      <div className="card row spread">
        <div>
          <h3>Delete this document</h3>
          <div className="muted small">Removes it, its classified rows and crops, and its students' progress in this subject.</div>
        </div>
        <button className="btn danger" disabled={busy !== null || running} onClick={clear}>Delete…</button>
      </div>
    </>
  );
}
