import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';

type Props = { searchParams: Promise<{ q?: string; category?: string; page?: string }> };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

/** Strips characters that would break a PostgREST .or()/.ilike() filter string. */
const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();

export default async function ProvidersPage({ searchParams }: Props) {
  const { q, category, page: pageRaw } = await searchParams;
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();
  const term = q ? sanitizeForFilter(q) : '';

  // Two separate builders rather than one branching on a flag: a ternary
  // between two differently-selected queries collapses TS's inferred row
  // type to their common subset ({id}), breaking property access below.
  const countQuery = () => {
    let q2 = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'provider');
    if (term) q2 = q2.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,provider_category.ilike.%${term}%,area.ilike.%${term}%`);
    if (category) q2 = q2.eq('provider_category', category);
    return q2;
  };
  const dataQuery = () => {
    let q2 = supabase
      .from('profiles')
      .select(
        'id, full_name, initials, area, phone, email, provider_category, provider_rating, provider_jobs_count, provider_verified, provider_certified, created_at, suspended_at',
      )
      .eq('role', 'provider');
    if (term) q2 = q2.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,provider_category.ilike.%${term}%,area.ilike.%${term}%`);
    if (category) q2 = q2.eq('provider_category', category);
    return q2;
  };

  // Stat cards summarize the whole provider table, independent of the
  // search/category filter and the current page - matched counts, not the
  // paginated rows, so they stay correct as the table grows past one page.
  const [
    { count: filteredTotal, error: countError },
    { count: allProviders, error: totalError },
    { count: verifiedCount, error: verifiedError },
    { count: certifiedCount, error: certifiedError },
    { data: categoryRows, error: categoryError },
  ] = await Promise.all([
    countQuery(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'provider'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'provider')
      .eq('provider_verified', true),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'provider')
      .eq('provider_verified', false)
      .eq('provider_certified', true),
    supabase.from('profiles').select('provider_category').eq('role', 'provider'),
  ]);

  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: providers, error: listError } = await dataQuery().order('created_at', { ascending: false }).range(from, to);

  const errors = [countError?.message, listError?.message, totalError?.message, verifiedError?.message, certifiedError?.message, categoryError?.message];

  const rows = providers ?? [];
  const verified = verifiedCount ?? 0;
  const certified = certifiedCount ?? 0;
  const pending = Math.max(0, (allProviders ?? 0) - verified - certified);
  const categories = [...new Set((categoryRows ?? []).map(p => p.provider_category).filter(Boolean))].sort();

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-eyebrow">Marketplace</div>
        <h1>Providers</h1>
        <p className="page-header-sub">Manage all service providers registered on the Solid Connect platform.</p>
      </div>

      <ErrorBanner errors={errors} />

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Providers</div>
          <div className="stat-card-value">{allProviders ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Verified</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{verified}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Certified</div>
          <div className="stat-card-value" style={{ color: 'var(--blue)' }}>{certified}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Unverified</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{pending}</div>
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
            className="search-input"
          />
        </form>
        <form style={{ display: 'flex', gap: 8 }}>
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
          <button
            type="submit"
            style={{
              padding: '10px 16px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Filter
          </button>
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
            {rows.length > 0 ? rows.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                      {p.initials}
                    </div>
                    <div>
                      <Link href={`/providers/${p.id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{p.full_name}</Link>
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
                  {p.suspended_at ? (
                    <span className="pill rejected">Suspended</span>
                  ) : p.provider_verified ? (
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
      <Pagination page={page} pageSize={PAGE_SIZE} total={total ?? 0} basePath="/providers" params={{ q, category }} />
    </>
  );
}
