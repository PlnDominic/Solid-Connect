import './globals.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { createServerSupabase } from '../lib/supabase';
import ThemeToggle from './components/ThemeToggle';
import NavLinks from './components/NavLinks';
import LogoutButton from './components/LogoutButton';

export const metadata = { title: 'Solid Connect Admin', description: 'Solid Connect operational administration' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <html data-theme="dark" className={`${GeistSans.variable} ${GeistMono.variable}`}><body>{children}</body></html>;
  const { data: admin } = await supabase.from('admins').select('id, email').eq('id', user.id).maybeSingle();
  if (!admin) { await supabase.auth.signOut(); redirect('/login?error=not-admin'); }
  const initials = (admin.email ?? 'A').slice(0, 2).toUpperCase();

  return (
    <html data-theme="dark" className={`${GeistSans.variable} ${GeistMono.variable}`}><body>
      <div className="shell">
        <aside className="side">
          <div className="brand">
            <img src="/logo.jpeg" alt="" width={26} height={26} />
            Solid Connect
          </div>
          <NavLinks />
          <div className="help-card">
            <p>Need help?<br />Feel free to contact</p>
            <a href="mailto:support@solidconnect.co">Get support →</a>
          </div>
          <div className="side-footer">
            <div className="avatar">{initials}</div>
            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin.email}</div>
            <LogoutButton />
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
