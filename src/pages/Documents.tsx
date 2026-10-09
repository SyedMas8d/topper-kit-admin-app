import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, subjectName } from '../api';
import type { Doc } from '../api';
import { Notice } from '../components/Layout';

export function stateOf(doc: Doc): { label: string; tone: string } {
  if (doc.published_at) return { label: 'Published', tone: 'live' };
  if (doc.status === 'FAILED') return { label: 'Failed', tone: 'bad' };
  if (doc.status === 'PROCESSING') return { label: 'Processing…', tone: 'warn' };
  if (doc.status === 'COMPLETED') return { label: 'Not published', tone: 'hidden' };
  return { label: 'Uploaded', tone: 'warn' };
}

export function Documents() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <Link to="/upload" className="btn amber" style={{ textDecoration: 'none' }}>Upload a book or paper</Link>
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
                    <td><b>{doc.title}</b><div className="muted small">{doc.filename}</div></td>
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
