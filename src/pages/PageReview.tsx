import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { Doubt, PageToCheck, ReadingStatus } from '../api';
import { Notice } from '../components/Layout';

// A line break in a page's words: headings, questions and options keep their own lines.
const LINE = '\n';

// Text typed in "Edit all", as words with a LINE where each line ends.
function toWords(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.split(/\s+/).filter(Boolean))
    .filter((line) => line.length)
    .flatMap((line, n) => (n ? [LINE, ...line] : line));
}

function toText(words: string[]): string {
  return words.join(' ').replace(/ ?\n ?/g, '\n');
}

const WHY: Record<Doubt['why'], string> = {
  disagree: 'The two readers differ here',
  script: 'Letters of another script inside a word',
  'only-cross-check': 'Only the cross-check read this (a box the reader may have missed)',
};

// One textbook page read from its image: the printed page beside its text. A doubt is settled
// by picking a reading or typing the word as printed; any other word can be fixed in "Edit all".
export function PageReview() {
  const { id = '', page: pageParam } = useParams();
  const [status, setStatus] = useState<ReadingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.readingStatus(id).then(setStatus).catch((e: Error) => setError(e.message));
  }, [id]);

  if (pageParam) return <PageEditor key={pageParam} id={id} current={Number(pageParam)} onStatus={setStatus} />;
  return (
    <>
      <div className="row spread">
        <h1>Check the text</h1>
        <Link to={`/documents/${id}`}>← Back to the book</Link>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {status && (
        <>
          <div className="muted">{status.pages_checked} of {status.pages.length} pages checked · {status.doubts_left} doubts left</div>
          <div className="card page-grid">
            {status.pages.map((p) => (
              <Link key={p.page} to={`/documents/${id}/pages/${p.page}`}
                className={`page-chip ${p.checked ? 'checked' : p.doubts || p.readers !== 'both' ? 'doubts' : ''}`}
                title={p.readers === 'none' ? 'Not read: type it in' : p.readers !== 'both' ? 'Read by one model only: check every word' : ''}>
                <b>p{p.page}</b><span>{p.checked ? '✓' : p.readers === 'none' ? '✎' : p.readers !== 'both' ? '1×' : p.doubts ? `${p.doubts}?` : '–'}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function PageEditor({ id, current, onStatus }: { id: string; current: number; onStatus: (s: ReadingStatus) => void }) {
  const navigate = useNavigate();
  const [page, setPage] = useState<PageToCheck | null>(null);
  // How each doubt was settled: the text to put there ('' removes / adds nothing).
  const [settled, setSettled] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [editAll, setEditAll] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .pageToCheck(id, current)
      .then((found) => {
        setPage(found);
        // Google refused both models this page: straight to typing it in.
        if (found.readers === 'none' && !found.checked) setEditAll(toText(found.words));
        // Straight to the first doubt: the reader's reading ready to keep with Enter.
        if (found.doubts.length && !found.checked) {
          setOpen(0);
          setTyped(found.doubts[0].readings[0]);
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [id, current]);

  // The page's words with each doubt's choice applied (or the reader's words where not settled).
  const finalWords = useMemo(() => {
    if (!page) return [];
    const byStart = new Map(page.doubts.map((d, i) => [d.at, i]));
    const out: string[] = [];
    let i = 0;
    while (i <= page.words.length) {
      const doubtIndex = byStart.get(i);
      if (doubtIndex !== undefined) {
        const d = page.doubts[doubtIndex];
        const choice = settled[doubtIndex];
        if (d.length === 0) {
          if (choice) out.push(...choice.split(/\s+/).filter(Boolean));
        } else {
          // Kept as read: the words themselves, so a doubt running onto the next line keeps its break.
          if (choice === undefined || choice === d.readings[0]) out.push(...page.words.slice(i, i + d.length));
          else out.push(...choice.split(/\s+/).filter(Boolean));
          i += d.length;
          continue;
        }
      }
      if (i < page.words.length) out.push(page.words[i]);
      i += 1;
    }
    return out;
  }, [page, settled]);

  const unsettled = page ? page.doubts.filter((_, i) => settled[i] === undefined).length : 0;

  async function save() {
    if (!page) return;
    setSaving(true);
    setError(null);
    try {
      const words = editAll !== null ? toWords(editAll) : finalWords;
      await api.checkPage(id, current, words);
      const fresh = await api.readingStatus(id);
      onStatus(fresh);
      // On to the next page that still needs checking.
      const next = fresh.pages.find((p) => !p.checked && p.page > current) ?? fresh.pages.find((p) => !p.checked);
      navigate(next ? `/documents/${id}/pages/${next.page}` : `/documents/${id}/pages`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openDoubtAt(index: number) {
    if (!page) return;
    setOpen(index);
    setTyped(settled[index] ?? page.doubts[index].readings[0]);
  }

  // Settle one doubt and open the next one not yet settled, so a page is gone through in order.
  function choose(index: number, text: string) {
    if (!page) return;
    const now = { ...settled, [index]: text };
    setSettled(now);
    const order = page.doubts.map((_, i) => i);
    const next = order.find((i) => i > index && now[i] === undefined) ?? order.find((i) => now[i] === undefined);
    if (next === undefined) {
      setOpen(null);
      setTyped('');
    } else {
      setOpen(next);
      setTyped(page.doubts[next].readings[0]);
    }
  }

  // After comparing the page with the book: the reader's reading for every doubt not yet touched.
  function readerForTheRest() {
    if (!page) return;
    setSettled((s) => Object.fromEntries(page.doubts.map((d, i) => [i, s[i] ?? d.readings[0]])));
    setOpen(null);
  }

  // The text, word by word, with each doubt shown as a button to settle it.
  function renderText(p: PageToCheck) {
    const byStart = new Map(p.doubts.map((d, i) => [d.at, i]));
    const parts: React.ReactNode[] = [];
    let i = 0;
    while (i <= p.words.length) {
      const doubtIndex = byStart.get(i);
      if (doubtIndex !== undefined) {
        const d = p.doubts[doubtIndex];
        const choice = settled[doubtIndex];
        const label = d.length === 0 ? (choice ? `+ ${choice}` : '＋?') : choice ?? d.readings[0];
        parts.push(
          <button key={`d${doubtIndex}`} className={`doubt ${choice !== undefined ? 'settled' : d.why}`}
            onClick={() => openDoubtAt(doubtIndex)} title={WHY[d.why]}>
            {label || '∅'}
          </button>,
          ' ',
        );
        if (d.length > 0) {
          i += d.length;
          continue;
        }
      }
      if (i < p.words.length) parts.push(p.words[i] === LINE ? <br key={`w${i}`} /> : <span key={`w${i}`}>{p.words[i]} </span>);
      i += 1;
    }
    return parts;
  }

  const openDoubt = page && open !== null ? page.doubts[open] : null;
  return (
    <>
      <div className="row spread">
        <h1>Page {current}</h1>
        <div className="row">
          <Link to={`/documents/${id}/pages`}>All pages</Link>
          <Link to={`/documents/${id}/pages/${Math.max(1, current - 1)}`}>← Prev</Link>
          <Link to={`/documents/${id}/pages/${current + 1}`}>Next →</Link>
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!page ? (
        <div className="muted">Loading…</div>
      ) : (
        <div className="review">
          <div className="card review-image">
            <div className="page-image">
              <img src={page.image} alt={`Printed page ${current}`} />
              {/* The same doubts, where they are printed: found from the PDF's word positions. */}
              {page.boxes.map((box, i) =>
                box ? (
                  <button
                    key={i}
                    ref={open === i ? (el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' }) : undefined}
                    className={`page-box ${settled[i] !== undefined ? 'settled' : page.doubts[i].why} ${open === i ? 'open' : ''}`}
                    style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%` }}
                    onClick={() => openDoubtAt(i)}
                    title={WHY[page.doubts[i].why]}
                  />
                ) : null,
              )}
            </div>
          </div>
          <div className="card stack">
            {!page.checked && page.readers === 'none' && (
              <Notice tone="error">Google would not read this page (its copyright filter). Type its text in below, as printed.</Notice>
            )}
            {!page.checked && (page.readers === 'reader' || page.readers === 'cross-check') && (
              <Notice tone="error">
                Only one model read this page ({page.readers === 'cross-check' ? 'the cheaper cross-check' : 'the reader'}); Google refused the
                other. There is nothing to compare, so check every word against the book.
              </Notice>
            )}
            <div className="small muted">
              {page.checked ? '✓ Checked. Saving again replaces it.' : `${page.doubts.length} doubts · ${unsettled} not settled yet`}
              {' · '}Amber: the readers differ. Red: other script. ＋?: text only the cross-check read.
              {' · '}<b>Enter</b> keeps the box, <b>Tab</b> takes the cross-check, <b>Esc</b> closes.
            </div>
            {editAll !== null ? (
              <textarea className="tamil-text" value={editAll} onChange={(e) => setEditAll(e.target.value)} rows={24} />
            ) : (
              <div className="tamil-text">{renderText(page)}</div>
            )}
            {openDoubt && open !== null && (
              <div className="doubt-panel stack">
                <b>{WHY[openDoubt.why]}</b>
                <div className="row">
                  {openDoubt.readings.map((reading, n) => (
                    <button key={n} className="btn soft" onClick={() => choose(open, reading)}>
                      {n === 0 ? 'Reader' : 'Cross-check'}: {reading || '(nothing)'}
                    </button>
                  ))}
                </div>
                <div className="row">
                  <input
                    key={open}
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter: keep what is in the box (the reader's reading, unless retyped).
                      // Tab: the cross-check's reading. Esc: close.
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        choose(open, typed.trim());
                      } else if (e.key === 'Tab') {
                        e.preventDefault();
                        choose(open, openDoubt.readings[1]);
                      } else if (e.key === 'Escape') {
                        setOpen(null);
                      }
                    }}
                    placeholder="Type it as printed"
                    style={{ flex: 1 }}
                  />
                  <button className="btn" onClick={() => choose(open, typed.trim())}>Use this</button>
                  <button className="btn soft" onClick={() => setOpen(null)}>Close</button>
                </div>
              </div>
            )}
            <div className="row spread">
              <div className="row">
                <button className="btn soft" onClick={() => setEditAll(editAll === null ? toText(finalWords) : null)}>
                  {editAll === null ? 'Edit all text' : 'Back to doubts'}
                </button>
                {editAll === null && unsettled > 0 && (
                  <button className="btn soft" onClick={readerForTheRest} title="After comparing the page with the book">
                    Reader is right for the rest ({unsettled})
                  </button>
                )}
              </div>
              <button className="btn amber" disabled={saving || (editAll === null && unsettled > 0)} onClick={save}
                title={unsettled > 0 && editAll === null ? 'Settle every doubt first' : ''}>
                {saving ? 'Saving…' : 'Page checked ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
