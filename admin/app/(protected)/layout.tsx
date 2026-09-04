import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { createClient } from '@/lib/supabase/server';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) redirect('/login');

  // RLS on public.admins only lets a row be read by its own admin (see
  // is_admin() and the "admins can read the admin list" policy in
  // 0005_admin_verification.sql) - a signed-in non-admin gets zero rows
  // back here, which is exactly the signal used to reject them.
  const { data: adminRow } = await supabase.from('admins').select('id').eq('id', sub).maybeSingle();
  if (!adminRow) {
    await supabase.auth.signOut();
    redirect('/login?error=not_admin');
  }

  return (
    <div className="flex min-h-screen">
      <Nav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
