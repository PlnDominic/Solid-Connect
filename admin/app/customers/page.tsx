import Link from 'next/link';
import { createServerSupabase } from '../../lib/supabase';

type Props = { searchParams: Promise<{ q?: string }> };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function CustomersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: customers, count: total } = await supabase
    .from('profiles')
    .select('id, full_name, initials, area, phone, email, created_at')
    .eq('role', 'customer')
    .order('created_at', { ascending: false });

  // Filter by search
  let filtered = customers ?? [];
  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(c =>
      c.full_name?.toLowerCase().includes(lower) ||
      c.email?.toLowerCase().includes(lower) ||
      c.area?.toLowerCase().includes(lower)
    );
  }

  // Get job counts per customer
  const customerIds = filtered.map(c => c.id);
  const { data: jobCounts } = customerIds.length > 0
    ? await supabase.from('jobs').select('customer_id').in('customer_id', customerIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  jobCounts?.forEach(j => { countMap[j.customer_id] = (countMap[j.customer_id] || 0) + 1; });

  // Total jobs across all customers
  const { count: totalJobs } = await supabase.from('jobs').select('*', { count: 'exact', head: true });

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-eyebrow">Marketplace</div>
        <h1>Customers</h1>
        <p className="page-header-sub">All customers who have signed up on the Solid Connect platform.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Customers</div>
          <div className="stat-card-value">{total ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Jobs Posted</div>
          <div className="stat-card-value">{totalJobs ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avg Jobs per Customer</div>
          <div className="stat-card-value">{total && total > 0 ? ((totalJobs ?? 0) / total).toFixed(1) : '0'}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <form>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search by name, email, or area..."
            style={{
              width: '100%', maxWidth: 400, padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: 13
            }}
          />
        </form>
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Area</th>
              <th>Phone</th>
              <th>Jobs Posted</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                      {c.initials}
                    </div>
                    <div>
                      <strong>{c.full_name}</strong>
                      <br />
                      <span className="mono">{c.email ?? 'No email'}</span>
                    </div>
                  </div>
                </td>
                <td>{c.area ?? '—'}</td>
                <td>{c.phone ?? '—'}</td>
                <td><span style={{ fontWeight: 700 }}>{countMap[c.id] ?? 0}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stamp(c.created_at)}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="empty">No customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
