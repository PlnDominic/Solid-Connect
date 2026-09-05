import Link from 'next/link';
import { createServerSupabase } from '../../lib/supabase';

type Props = { searchParams: Promise<{ q?: string; category?: string }> };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function ProvidersPage({ searchParams }: Props) {
  const { q, category } = await searchParams;
  const supabase = await createServerSupabase();

  // Fetch all providers
  let query = supabase
    .from('profiles')
    .select('id, full_name, initials, area, phone, email, provider_category, provider_rating, provider_jobs_count, provider_verified, provider_certified, created_at')
    .eq('role', 'provider')
    .order('created_at', { ascending: false });

  const { data: providers, count: total } = await query;

  // Filter by search
  let filtered = providers ?? [];
  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(p =>
      p.full_name?.toLowerCase().includes(lower) ||
      p.email?.toLowerCase().includes(lower) ||
      p.provider_category?.toLowerCase().includes(lower) ||
      p.area?.toLowerCase().includes(lower)
    );
  }
  if (category) {
    filtered = filtered.filter(p => p.provider_category === category);
  }

  // Stats
  const allProviders = providers ?? [];
  const verifiedCount = allProviders.filter(p => p.provider_verified).length;
  const certifiedCount = allProviders.filter(p => p.provider_certified).length;
  const pendingCount = allProviders.filter(p => !p.provider_verified && !p.provider_certified).length;

  // Unique categories
  const categories = [...new Set(allProviders.map(p => p.provider_category).filter(Boolean))].sort();

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-eyebrow">Marketplace</div>
        <h1>Providers</h1>
        <p className="page-header-sub">Manage all service providers registered on the Solid Connect platform.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Providers</div>
          <div className="stat-card-value">{total ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Verified</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{verifiedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Certified</div>
          <div className="stat-card-value" style={{ color: 'var(--blue)' }}>{certifiedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Unverified</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{pendingCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <form style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search by name, email, category, or area..."
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: 13
            }}
          />
        </form>
        <form>
          <select
            name="category"
            defaultValue={category ?? ''}
            style={{
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: 13
            }}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </form>
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Category</th>
              <th>Area</th>
              <th>Rating</th>
              <th>Jobs</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                      {p.initials}
                    </div>
                    <div>
                      <strong>{p.full_name}</strong>
                      <br />
                      <span className="mono">{p.email ?? 'No email'}</span>
                    </div>
                  </div>
                </td>
                <td>{p.provider_category ?? '—'}</td>
                <td>{p.area ?? '—'}</td>
                <td>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    {p.provider_rating?.toFixed(1) ?? '—'} ★
                  </span>
                </td>
                <td>{p.provider_jobs_count ?? 0}</td>
                <td>
                  {p.provider_verified ? (
                    <span className="pill approved">Verified</span>
                  ) : p.provider_certified ? (
                    <span className="pill" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>Certified</span>
                  ) : (
                    <span className="pill pending">Pending</span>
                  )}
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stamp(p.created_at)}</td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="empty">No providers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
