import Link from 'next/link';

const ITEMS = [
  { label: 'Verifications', href: '/verifications', enabled: true },
  { label: 'Disputes', href: '#', enabled: false },
  { label: 'Analytics', href: '#', enabled: false },
  { label: 'Catalog', href: '#', enabled: false },
] as const;

export function Nav() {
  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 p-6">
      <div className="mb-8 text-lg font-semibold">Solid Connect Admin</div>
      <ul className="flex flex-col gap-1">
        {ITEMS.map((item) => (
          <li key={item.label}>
            {item.enabled ? (
              <Link href={item.href} className="block rounded px-3 py-2 text-sm hover:bg-gray-100">
                {item.label}
              </Link>
            ) : (
              <span className="block rounded px-3 py-2 text-sm text-gray-300">{item.label} (soon)</span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
