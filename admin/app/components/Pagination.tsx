import Link from 'next/link';

/** Prev/Next pager for a server-paginated list. `params` should carry every
 * other active search param (search text, status/category filters, etc.) so
 * changing page doesn't drop them. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) sp.set(key, value);
    }
    sp.set('page', String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 12, marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)',
      }}
    >
      <span>
        {from}–{to} of {total}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={atStart}
          tabIndex={atStart ? -1 : undefined}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: atStart ? 'var(--text-muted)' : 'var(--text-primary)',
            pointerEvents: atStart ? 'none' : 'auto', fontWeight: 600,
          }}
        >
          Prev
        </Link>
        <span style={{ padding: '6px 4px', fontVariantNumeric: 'tabular-nums' }}>
          Page {page} of {totalPages}
        </span>
        <Link
          href={hrefFor(Math.min(totalPages, page + 1))}
          aria-disabled={atEnd}
          tabIndex={atEnd ? -1 : undefined}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: atEnd ? 'var(--text-muted)' : 'var(--text-primary)',
            pointerEvents: atEnd ? 'none' : 'auto', fontWeight: 600,
          }}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

export const PAGE_SIZE = 25;

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** PostgREST 416s ("Requested range not satisfiable") a .range() whose
 * start is past the last row - e.g. a stale ?page=9 bookmark once older
 * rows are gone. Clamp the requested page to what the (already-known)
 * total actually supports before building the range, so that case just
 * quietly serves the last valid page instead of erroring. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, page), totalPages);
}
