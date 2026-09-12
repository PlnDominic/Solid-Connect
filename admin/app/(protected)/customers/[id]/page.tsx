import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '../../../../lib/supabase';

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const currency = (n: number) => `$${(n ?? 0).toLocaleString('en-US')}`;

const reasonLabel: Record<string, string> = {
  not_completed: 'Not completed',
  poor_quality: 'Poor quality',
  overcharged: 'Overcharged',
  no_show: 'No-show',
  other: 'Other',
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: customer } = await supabase
    .from('profiles')
    .select('id, full_name, initials, area, phone, email, created_at')
    .eq('id', id)
    .eq('role', 'customer')
    .maybeSingle();
  if (!customer) notFound();

  const [{ data: jobs }, { data: disputes }, { data: reviews }] = await Promise.all([
    supabase.from('jobs').select('id, title, price, status, started_at').eq('customer_id', id).order('started_at', { ascending: false }).limit(25),
    supabase.from('disputes').select('id, reason, status, created_at, job_id').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('reviews').select('rating, comment, created_at, job_id').eq('customer_id', id).order('created_at', { ascending: false }).limit(25),
  ]);

  const jobRows = jobs ?? [];
  const completedJobs = jobRows.filter((j) => j.status === 'completed');
  const totalSpend = completedJobs.reduce((sum, j) => sum + (j.price ?? 0), 0);

  return (
    <>
      <Link className="mono" href="/customers">← Back to customers</Link>

      <div className="topline" style={{ marginTop: 20 }}>
        <div>
          <p className="eyebrow">Customer</p>
          <h1 className="heading">{customer.full_name}</h1>
          <p className="intro">{customer.area} · Joined {stamp(customer.created_at)}</p>
        </div>
        <div className="stat" style={{ minWidth: 160 }}>
          <b>{currency(totalSpend)}</b>
          <span>Total spend · {completedJobs.length} completed jobs</span>
        </div>
      </div>

      <div className="detail">
        <section className="panel">
          <h2>Profile</h2>
          <div className="facts">
            <div><label>Phone</label><strong>{customer.phone ?? 'Not provided'}</strong></div>
            <div><label>Email</label><strong>{customer.email ?? 'Not provided'}</strong></div>
            <div><label>Jobs posted</label><strong>{jobRows.length}</strong></div>
            <div><label>Area</label><strong>{customer.area}</strong></div>
          </div>

          <h2 style={{ marginTop: 28 }}>Job history</h2>
          {jobRows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {jobRows.map((j) => (
                <Link key={j.id} href={`/jobs/${j.id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{j.title || 'Untitled'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{currency(j.price)} · {j.status.replaceAll('_', ' ')}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No jobs posted yet.</p>
          )}
        </section>

        <aside className="panel">
          <h2>Disputes filed</h2>
          {(disputes ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(disputes ?? []).map((d) => (
                <Link key={d.id} href={`/disputes/${d.id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{reasonLabel[d.reason] ?? d.reason}</span>
                  <span className={`pill ${d.status === 'resolved' ? 'approved' : 'pending'}`}>{d.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No disputes filed.</p>
          )}

          <h2 style={{ marginTop: 28 }}>Reviews written</h2>
          {(reviews ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(reviews ?? []).map((r, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  <strong>{r.rating}★</strong>{r.comment ? ` — ${r.comment}` : ''}
                  <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{stamp(r.created_at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No reviews written yet.</p>
          )}
        </aside>
      </div>
    </>
  );
}
