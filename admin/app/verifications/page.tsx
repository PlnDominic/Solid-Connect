import Link from 'next/link';
import { createServerSupabase } from '../../lib/supabase';

type Props = { searchParams: Promise<{ status?: string }> };
const statuses = ['pending', 'approved', 'rejected'];
const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function VerificationsPage({ searchParams }: Props) {
  const { status: requested } = await searchParams; const status = statuses.includes(requested ?? '') ? requested! : 'pending'; const supabase = await createServerSupabase();
  const [{ data: rows, error }, { count }] = await Promise.all([
    supabase.from('provider_verifications').select('id,status,submitted_at,profiles!provider_verifications_provider_id_fkey(full_name,provider_category,area)').eq('status', status).order('submitted_at', { ascending: true }),
    supabase.from('provider_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  if (error) throw new Error(error.message);
  return <><div className="topline"><div><p className="eyebrow">Trust & safety</p><h1 className="heading">Provider verification</h1><p className="intro">Review identity documents before a provider can carry the Solid Connect verification mark.</p></div><div className="stat"><b>{count ?? 0}</b><span>awaiting review</span></div></div><nav className="tabs">{statuses.map(item => <Link key={item} className={item === status ? 'selected' : ''} href={`/verifications?status=${item}`}>{item[0].toUpperCase() + item.slice(1)}</Link>)}</nav>{rows?.length ? <table className="table"><thead><tr><th>Provider</th><th>Trade</th><th>Area</th><th>Submitted</th><th>Status</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.id}><td><Link href={`/verifications/${row.id}`}><strong>{row.profiles?.full_name ?? 'Unknown provider'}</strong></Link><br /><span className="mono">{row.id.slice(0, 8)}</span></td><td>{row.profiles?.provider_category ?? '—'}</td><td>{row.profiles?.area ?? '—'}</td><td>{stamp(row.submitted_at)}</td><td><span className={`pill ${row.status}`}>{row.status}</span></td></tr>)}</tbody></table> : <div className="empty">No {status} verification submissions.</div>}</>;
}
