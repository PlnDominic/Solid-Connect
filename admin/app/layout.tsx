import './globals.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '../lib/supabase';
import ThemeToggle from './components/ThemeToggle';

export const metadata = { title: 'Solid Connect Admin', description: 'Solid Connect operational administration' };

function NavIcon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <html data-theme="dark"><body>{children}</body></html>;
  const { data: admin } = await supabase.from('admins').select('id, email').eq('id', user.id).maybeSingle();
  if (!admin) { await supabase.auth.signOut(); redirect('/login?error=not-admin'); }
  const initials = (admin.email ?? 'A').slice(0, 2).toUpperCase();

  return (
    <html data-theme="dark"><body>
      <div className="shell">
        <aside className="side">
          <div className="brand">
            <img src="/logo.jpeg" alt="" width={26} height={26} />
            Solid Connect
          </div>
          <nav className="nav">
            <Link href="/analytics">
              <NavIcon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
              Overview
            </Link>
            <Link href="/verifications">
              <NavIcon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              Verifications
            </Link>
            <Link href="/providers">
              <NavIcon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              Providers
            </Link>
            <Link href="/customers">
              <NavIcon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              Customers
            </Link>
            <Link href="/settings">
              <NavIcon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              Settings
            </Link>
          </nav>
          <div className="help-card">
            <p>Need help?<br />Feel free to contact</p>
            <a href="mailto:support@solidconnect.co">Get support →</a>
          </div>
          <div className="side-footer">
            <div className="avatar">{initials}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin.email}</div>
          </div>
        </aside>
        <main className="main">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <ThemeToggle />
          </div>
          {children}
        </main>
      </div>
    </body></html>
  );
}
