import './globals.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '../lib/supabase';

export const metadata = { title: 'Solid Connect Admin', description: 'Solid Connect operational administration' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const isLogin = false;
  if (!user) return <html><body>{children}</body></html>;
  const { data: admin } = await supabase.from('admins').select('id').eq('id', user.id).maybeSingle();
  if (!admin) { await supabase.auth.signOut(); redirect('/login?error=not-admin'); }
  return <html><body><div className="shell"><aside className="side"><div className="brand">solid connect<small>operations desk</small></div><nav className="nav"><Link className="active" href="/verifications">Verifications</Link><span>Disputes · soon</span><span>Analytics · soon</span><span>Catalog · soon</span></nav><footer>Signed in as<br />{user.email}</footer></aside><main className="main">{children}</main></div></body></html>;
}
