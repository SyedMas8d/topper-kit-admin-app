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

// A file the server sends (a book bundle), saved through the browser: the admin key travels in
// a header, so a plain link cannot fetch it.
async function download(path: string, filename: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${session.server()}${path}`, { headers: { 'X-Admin-Key': session.key() ?? '' } });
  } catch {
    throw new ApiError(`Can't reach ${session.server()}.`, 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(describe(body.detail, res.status), res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// --- Types (as the API sends them) -------------------------------------------------------

export type Subject = 'SCIENCE' | 'MATHEMATICS' | 'SOCIAL_SCIENCE' | 'ENGLISH' | string;
export type DocumentType = 'TEXTBOOK' | 'QUESTION_PAPER';

// A book bundle uploaded for import, waiting for a confirm: what it is, and what it would meet.
export type BookSummary = { id: string; title: string; board: string | null; class_level: string | null; subject: Subject | null; document_type: DocumentType; volume?: number | null; published: boolean };
export type ImportWaiting = { token: string; document: BookSummary; same_id: BookSummary | null; same_book: BookSummary | null };
export type ImportDone = { document_id: string; title: string; rows: Record<string, number>; chunks: number; files: number };

export type Doc = {
  id: string;
  title: string;
  filename: string;
  class_level: string | null;
  subject: Subject;
  document_type: DocumentType;
  exam_year: number | null;
  volume: number | null; // a textbook printed in volumes: which one
  read_from_images: boolean; // read from its page images (always so for STATE_TAMIL)
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

export type Child = {
  id: string;
  name: string;
  board: string;
  class_level: string;
  created_at: string;
  last_seen_at: string | null;
  studying_now: boolean;
};
export type ParentAccount = {
  id: string;
  email: string;
  name: string | null;
  sign_in: 'google' | 'password' | 'both';
  email_verified: boolean;
  phone: string | null; // "+919876543210", set once verified
  phone_verified: boolean;
  created_at: string;
  children: Child[];
};
export type ParentsPage = { total: number; page: number; page_size: number; parents: ParentAccount[] };

// Reading a book from its page images (Tamil-medium books), and checking each page.
export type Doubt = {
  at: number; // word index
  length: number; // words covered; 0: text only the cross-check read, offered to add
  readings: [string, string]; // [the reader's, the cross-check's]
  why: 'disagree' | 'script' | 'only-cross-check';
};
export type ReadingStatus = {
  reads_from_image: boolean;
  jobs: { model: string; status: 'uploading' | 'running' | 'done' | 'failed'; pages: number; error: string | null; started_at: string; finished_at: string | null }[];
  // readers: 'both'; the one model read it when Google refused the other ('reader' | 'cross-check'); 'none': type it in.
  pages: { page: number; doubts: number; checked: boolean; readers: string }[];
  pages_checked: number;
  doubts_left: number;
  refused: number[]; // pages Google's copyright filter refused to one model or both: never sent again
  unread: number; // pages still to be read
};
// boxes: each doubt's place on the image, [x0, y0, x1, y1] as fractions of the page (null: unknown).
export type PageToCheck = { page: number; words: string[]; doubts: Doubt[]; checked: boolean; readers: string; image: string; boxes: ([number, number, number, number] | null)[] };

// --- Calls ---------------------------------------------------------------------------------

// The classify routes are named by board and subject: /api/v1/admin/state/classify/science.
export const SUBJECT_SLUGS: Record<string, string> = {
  SCIENCE: 'science',
  MATHEMATICS: 'math',
  SOCIAL_SCIENCE: 'social-science',
  ENGLISH: 'english',
  PHYSICS: 'physics',
  CHEMISTRY: 'chemistry',
  BIOLOGY: 'biology',
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
  // A finished book moved between servers: exported on one, imported on another.
  exportBook: (doc: Doc) =>
    download(`/api/v1/admin/documents/${doc.id}/export`, `${doc.title.replace(/[^\p{L}\p{N} ._-]/gu, '')} (${doc.board}).topperkit.zip`),
  receiveBook: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return call<ImportWaiting>('/api/v1/admin/documents/import', { method: 'POST', body: form });
  },
  importBook: (token: string) => call<ImportDone>(`/api/v1/admin/documents/import/${token}`, { method: 'POST' }),
  process: (id: string) => call<{ status: string; page_count: number; chunk_count: number }>(`/api/v1/documents/${id}/process`, { method: 'POST' }),
  classify: (doc: Doc) => call<Job>(classifyPath(doc), json({ document_id: doc.id })),
  job: (id: string) => call<Job>(`/api/v1/admin/jobs/${id}`),
  jobs: (documentId: string) => call<Job[]>(`/api/v1/admin/jobs?document_id=${encodeURIComponent(documentId)}`),
  publish: (id: string) => call<{ published_at: string | null }>(`/api/v1/admin/documents/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) => call<{ also_unpublished: string[] }>(`/api/v1/admin/documents/${id}/unpublish`, { method: 'POST' }),
  clear: (id: string) => call<{ chunks: number; files: string[]; progress_items: number }>('/api/v1/admin/clear', json({ document_id: id })),
  crop: (path: string) => call<{ data_uri: string }>(`/api/v1/admin/files?path=${encodeURIComponent(path)}`),
  usage: (from: string, to: string) => call<Usage>(`/api/v1/admin/usage?from=${from}&to=${to}`),
  readPages: (id: string, pages: number[] = []) => call<ReadingStatus>(`/api/v1/admin/documents/${id}/pages/read`, json({ pages })),
  readingStatus: (id: string) => call<ReadingStatus>(`/api/v1/admin/documents/${id}/pages`),
  pageToCheck: (id: string, page: number) => call<PageToCheck>(`/api/v1/admin/documents/${id}/pages/${page}`),
  checkPage: (id: string, page: number, words: string[]) =>
    call<{ page: number; checked: boolean }>(`/api/v1/admin/documents/${id}/pages/${page}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }),
    }),
  parents: (page: number, pageSize: number, q: string) =>
    call<ParentsPage>(`/api/v1/admin/parents?page=${page}&page_size=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
};

export const SUBJECTS: Record<string, string> = {
  SCIENCE: 'Science',
  MATHEMATICS: 'Mathematics',
  SOCIAL_SCIENCE: 'Social Science',
  ENGLISH: 'English',
  PHYSICS: 'Physics',
  CHEMISTRY: 'Chemistry',
  BIOLOGY: 'Biology',
};
export const subjectName = (s: string) => SUBJECTS[s] ?? s;
