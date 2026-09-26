'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function MobileSidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="mobile-bar">
        <div className="mobile-brand">
          <img src="/logo.jpeg" alt="" width={26} height={26} />
          Solid Connect
        </div>
        <button
          type="button"
          className="hamburger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen(o => !o)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>
      <div className={`side-backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="admin-sidebar" className={`side${open ? ' open' : ''}`}>
        {children}
      </aside>
    </>
  );
}
