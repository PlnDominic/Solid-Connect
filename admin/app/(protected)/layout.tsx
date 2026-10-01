import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerSupabase } from '../../lib/supabase';
import { ADMIN_PERMISSIONS } from '../../lib/admin';
import ThemeToggle from '../components/ThemeToggle';
import NavLinks from '../components/NavLinks';
import MobileSidebar from '../components/MobileSidebar';
import LogoutButton from '../components/LogoutButton';

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('admin-theme')?.value === 'light' ? 'light' : 'dark';
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: admin } = await supabase.from('admins').select('id, email, role, disabled_at, permissions').eq('id', user.id).maybeSingle();
  if (!admin || admin.disabled_at) { await supabase.auth.signOut(); redirect('/login?error=not-admin'); }
  const { count: openSafetyAlerts } = await supabase
    .from('safety_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');
  const initials = (admin.email ?? 'A').slice(0, 2).toUpperCase();
  // Owners implicitly hold every scope - only a support admin's own
  // permissions array actually narrows the sidebar (see NavLinks, which
  // hides the handful of nav items that are pure action surfaces with
  // nothing to see once you can't act on them).
  const permissions = admin.role === 'owner' ? [...ADMIN_PERMISSIONS] : admin.permissions ?? [];
  const isOwner = admin.role === 'owner';

  return (
    <div className="shell">
      <MobileSidebar>
        <div className="brand">
          <img src="/logo.jpeg" alt="" width={26} height={26} />
          Solid Connect
        </div>
        <Suspense fallback={null}>
          <NavLinks permissions={permissions} isOwner={isOwner} />
        </Suspense>
        <div className="help-card">
          <p>Need help?<br />Feel free to contact</p>
          <a href="mailto:support@solidconnect.co">Get support →</a>
        </div>
        <div className="side-footer">
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{admin.email}</div>
          <LogoutButton />
        </div>
      </MobileSidebar>
      <main className="main">
        {openSafetyAlerts ? (
          <a href="/safety" className="safety-banner">
            {openSafetyAlerts} open safety alert{openSafetyAlerts === 1 ? '' : 's'}. Follow up now →
          </a>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
          <form action="/search" style={{ flex: 1, maxWidth: 360 }}>
            <input type="text" name="q" placeholder="Search customers, providers, requests, jobs…" className="search-input" />
          </form>
          <ThemeToggle initialTheme={theme} />
        </div>
        {children}
      </main>
    </div>
  );
}
