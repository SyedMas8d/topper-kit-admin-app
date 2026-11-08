// A card that opens and closes by its heading (the browser's own <details>): long settings stay
// short to scan. open: how it starts; the admin toggles it from there.
export function Fold({
  title,
  hint,
  badge,
  open = false,
  level = 2,
  nested = false,
  children,
}: {
  title: string;
  hint?: string;
  badge?: React.ReactNode;
  open?: boolean;
  level?: 2 | 3;
  nested?: boolean; // inside another card
  children: React.ReactNode;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <details className={`card fold${nested ? ' nested' : ''}`} open={open}>
      <summary>
        <span className="fold-head">
          <Heading>{title}</Heading>
          {badge}
        </span>
        {hint && <span className="small muted">{hint}</span>}
      </summary>
      <div className="stack fold-body">{children}</div>
    </details>
  );
}
