import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerSupabase } from '../../lib/supabase';
import ThemeToggle from '../components/ThemeToggle';
import NavLinks from '../components/NavLinks';
import LogoutButton from '../components/LogoutButton';

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('admin-theme')?.value === 'light' ? 'light' : 'dark';
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: admin } = await supabase.from('admins').select('id, email').eq('id', user.id).maybeSingle();
  if (!admin) { await supabase.auth.signOut(); redirect('/login?error=not-admin'); }
  const initials = (admin.email ?? 'A').slice(0, 2).toUpperCase();

  return (
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
          <ThemeToggle initialTheme={theme} />
        </div>
        {children}
      </main>
    </div>
  );
}
