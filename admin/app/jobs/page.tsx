import Link from 'next/link';
import { createServerSupabase } from '../../lib/supabase';

type Props = { searchParams: Promise<{ status?: string; q?: string }> };
const statuses = ['all', 'in_progress', 'completed'];
const statusLabels: Record<string, string> = { all: 'All', in_progress: 'In Progress', completed: 'Completed' };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const currency = (n: number) => `$${n.toLocaleString('en-US')}`;

export default async function JobsPage({ searchParams }: Props) {
  const { status: requested, q } = await searchParams;
  const status = statuses.includes(requested ?? '') ? requested! : 'all';
  const supabase = await createServerSupabase();

  // Base query
  let query = supabase
    .from('jobs')
    .select('id, title, price, location_label, status, started_at, completed_at, customer_id, provider_id')
    .order('started_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: jobs } = await query;

  // Filter by search
  let filtered = jobs ?? [];
  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(j =>
      j.title?.toLowerCase().includes(lower) ||
      j.location_label?.toLowerCase().includes(lower)
    );
  }

  // Stats
  const allJobs = jobs ?? [];
  const completedJobs = allJobs.filter(j => j.status === 'completed');
  const inProgressJobs = allJobs.filter(j => j.status === 'in_progress');
  const totalRevenue = completedJobs.reduce((s, j) => s + (j.price ?? 0), 0);
  const avgPrice = completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0;

  // Get provider and customer names for display
  const providerIds = [...new Set(filtered.map(j => j.provider_id).filter(Boolean))];
  const customerIds = [...new Set(filtered.map(j => j.customer_id).filter(Boolean))];

  const [{ data: providers }, { data: customers }] = await Promise.all([
    providerIds.length > 0
      ? supabase.from('profiles').select('id, full_name, initials').in('id', providerIds)
      : { data: [] },
    customerIds.length > 0
      ? supabase.from('profiles').select('id, full_name, initials').in('id', customerIds)
      : { data: [] },
  ]);

  const providerMap: Record<string, any> = {};
  providers?.forEach(p => { providerMap[p.id] = p; });
  const customerMap: Record<string, any> = {};
  customers?.forEach(c => { customerMap[c.id] = c; });

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-eyebrow">Operations</div>
        <h1>Jobs</h1>
        <p className="page-header-sub">Track all service jobs across the Solid Connect marketplace.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Jobs</div>
          <div className="stat-card-value">{allJobs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Completed</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{completedJobs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">In Progress</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{inProgressJobs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Revenue</div>
          <div className="stat-card-value">{currency(totalRevenue)}</div>
          <div className="stat-card-sub">Avg: {currency(avgPrice)}</div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <nav className="tabs" style={{ margin: 0 }}>
          {statuses.map(s => (
            <Link
              key={s}
              className={s === status ? 'selected' : ''}
              href={`/jobs?status=${s}${q ? `&q=${q}` : ''}`}
            >
              {statusLabels[s]}
            </Link>
          ))}
        </nav>
        <form>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search jobs..."
            style={{
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: 13, width: 240
            }}
          />
        </form>
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Provider</th>
              <th>Customer</th>
              <th>Price</th>
              <th>Location</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(j => {
              const prov = providerMap[j.provider_id];
              const cust = customerMap[j.customer_id];
              return (
                <tr key={j.id}>
                  <td><strong>{j.title || 'Untitled'}</strong></td>
                  <td>
                    {prov ? (
                      <div className="profile-cell">
                        <div className="profile-avatar" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', width: 28, height: 28, fontSize: 10 }}>
                          {prov.initials}
                        </div>
                        <span>{prov.full_name}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    {cust ? (
                      <div className="profile-cell">
                        <div className="profile-avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', width: 28, height: 28, fontSize: 10 }}>
                          {cust.initials}
                        </div>
                        <span>{cust.full_name}</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ fontWeight: 700 }}>{currency(j.price ?? 0)}</td>
                  <td>{j.location_label ?? '—'}</td>
                  <td>
                    <span className={`pill ${j.status === 'completed' ? 'approved' : 'pending'}`}>
                      {j.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {stamp(j.started_at)}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7} className="empty">No jobs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
