import Link from 'next/link';

/** A <th> that's also a sort toggle: click once for ascending, again for
 * descending, carrying every other current search param through so
 * sorting doesn't reset search/filters. */
export function SortHeader({
  label,
  field,
  currentSort,
  currentDir,
  basePath,
  params,
}: {
  label: string;
  field: string;
  currentSort: string;
  currentDir: 'asc' | 'desc';
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === 'asc' ? 'desc' : 'asc';
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  sp.set('sort', field);
  sp.set('dir', nextDir);

  return (
    <th>
      <Link href={`${basePath}?${sp.toString()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: isActive ? 'var(--text-primary)' : 'inherit' }}>
        {label}
        <span style={{ fontSize: 9, opacity: isActive ? 1 : 0.35 }}>{isActive && currentDir === 'desc' ? '▼' : '▲'}</span>
      </Link>
    </th>
  );
}
