// The TopperKit API, called with the admin key. The key and the server are kept for this
// browser tab only (sessionStorage): closing the tab logs out.

const KEY = 'tk-admin-key';
const SERVER = 'tk-admin-server';

export const SERVERS = {
  production: import.meta.env.VITE_PRODUCTION_API ?? 'https://api.topperkit.com',
  local: import.meta.env.VITE_LOCAL_API ?? 'http://localhost:8001',
};

export const session = {
  key: () => sessionStorage.getItem(KEY),
  server: () => sessionStorage.getItem(SERVER) ?? SERVERS.production,
  save(key: string, server: string) {
    sessionStorage.setItem(KEY, key);
    sessionStorage.setItem(SERVER, server);
  },
  clear() {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(SERVER);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// FastAPI says what went wrong in `detail`: a sentence, or a list of field problems.
function describe(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string; loc?: string[] }) => `${d.loc?.slice(-1)[0] ?? ''}: ${d.msg}`).join('. ');
  return `Request failed (${status})`;
}

async function call<T>(path: string, init: RequestInit = {}, key = session.key(), server = session.server()): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, { ...init, headers: { ...(key ? { 'X-Admin-Key': key } : {}), ...(init.headers ?? {}) } });
  } catch {
    throw new ApiError(`Can't reach ${server}. Is the server running, and does it allow this page (CORS_ORIGINS)?`, 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(describe(body.detail, res.status), res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// --- Types (as the API sends them) -------------------------------------------------------

export type Subject = 'SCIENCE' | 'MATHEMATICS' | 'SOCIAL_SCIENCE' | 'ENGLISH' | string;
export type DocumentType = 'TEXTBOOK' | 'QUESTION_PAPER';

export type Doc = {
  id: string;
  title: string;
  filename: string;
  class_level: string | null;
  subject: Subject;
  document_type: DocumentType;
  exam_year: number | null;
  board: string | null;
  status: string;
  page_count: number | null;
  chunk_count: number | null;
  published_at: string | null;
  created_at: string;
};

export type Job = {
  id: string;
  document_id: string;
  status: 'running' | 'done' | 'failed';
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type UsageRow = { calls: number; input_tokens: number; output_tokens: number; estimated_cost: number | null; label?: string };
export type Usage = {
  from: string;
  to: string;
  currency: string;
  total: UsageRow;
  by_purpose: Record<string, UsageRow>;
  by_day: Record<string, UsageRow>;
};

// --- Calls ---------------------------------------------------------------------------------

// The classify routes are named by board and subject: /api/v1/admin/state/classify/science.
export const SUBJECT_SLUGS: Record<string, string> = {
  SCIENCE: 'science',
  MATHEMATICS: 'math',
  SOCIAL_SCIENCE: 'social-science',
  ENGLISH: 'english',
};

function classifyPath(doc: Doc): string {
  const slug = SUBJECT_SLUGS[doc.subject];
  if (!slug || !doc.board) throw new ApiError(`No classify template for ${doc.board ?? '?'} ${doc.subject} yet.`, 404);
  const paper = doc.document_type === 'QUESTION_PAPER' ? '/paper' : '';
  return `/api/v1/admin/${doc.board.toLowerCase()}/classify/${slug}${paper}/start`;
}

export const api = {
  // A key that lists the documents is a working admin key.
  check: (key: string, server: string) => call<Doc[]>('/api/v1/documents', {}, key, server),
  documents: () => call<Doc[]>('/api/v1/documents'),
  document: (id: string) => call<Doc>(`/api/v1/documents/${id}`),
  upload: (form: FormData) => call<Doc>('/api/v1/documents', { method: 'POST', body: form }),
  process: (id: string) => call<{ status: string; page_count: number; chunk_count: number }>(`/api/v1/documents/${id}/process`, { method: 'POST' }),
  classify: (doc: Doc) => call<Job>(classifyPath(doc), json({ document_id: doc.id })),
  job: (id: string) => call<Job>(`/api/v1/admin/jobs/${id}`),
  jobs: (documentId: string) => call<Job[]>(`/api/v1/admin/jobs?document_id=${encodeURIComponent(documentId)}`),
  publish: (id: string) => call<{ published_at: string | null }>(`/api/v1/admin/documents/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) => call<{ also_unpublished: string[] }>(`/api/v1/admin/documents/${id}/unpublish`, { method: 'POST' }),
  clear: (id: string) => call<{ chunks: number; files: string[]; progress_items: number }>('/api/v1/admin/clear', json({ document_id: id })),
  crop: (path: string) => call<{ data_uri: string }>(`/api/v1/admin/files?path=${encodeURIComponent(path)}`),
  usage: (from: string, to: string) => call<Usage>(`/api/v1/admin/usage?from=${from}&to=${to}`),
};

export const SUBJECTS: Record<string, string> = {
  SCIENCE: 'Science',
  MATHEMATICS: 'Mathematics',
  SOCIAL_SCIENCE: 'Social Science',
  ENGLISH: 'English',
};
export const subjectName = (s: string) => SUBJECTS[s] ?? s;
