import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { SortHeader } from '../../components/SortHeader';

type Props = { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }> };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

/** Strips characters that would break a PostgREST .or()/.ilike() filter string. */
const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();
const SORTABLE = ['full_name', 'area', 'created_at'];

export default async function CustomersPage({ searchParams }: Props) {
  const { q, page: pageRaw, sort: sortRaw, dir: dirRaw } = await searchParams;
  const requestedPage = parsePage(pageRaw);
  const sort = SORTABLE.includes(sortRaw ?? '') ? sortRaw! : 'created_at';
  const dir: 'asc' | 'desc' = dirRaw === 'asc' ? 'asc' : 'desc';
  const supabase = await createServerSupabase();
  const term = q ? sanitizeForFilter(q) : '';

  // Two separate builders rather than one branching on a flag: a ternary
  // between two differently-selected queries collapses TS's inferred row
  // type to their common subset ({id}), breaking property access below.
  const countQuery = () => {
    let q2 = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer');
    if (term) q2 = q2.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,area.ilike.%${term}%`);
    return q2;
  };
  const dataQuery = () => {
    let q2 = supabase.from('profiles').select('id, full_name, initials, area, phone, email, created_at').eq('role', 'customer');
    if (term) q2 = q2.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,area.ilike.%${term}%`);
    return q2;
  };

  const [
    { count: filteredTotal, error: countError },
    // Total Customers stat reflects the whole table, independent of search.
    { count: allCustomers, error: totalError },
    { count: totalJobs, error: jobsError },
  ] = await Promise.all([
    countQuery(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
  ]);

  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: customers, error: listError } = await dataQuery().order(sort, { ascending: dir === 'asc' }).range(from, to);

  const rows = customers ?? [];

  // Job counts for just the rows on this page.
  const customerIds = rows.map(c => c.id);
  const { data: jobCounts, error: jobCountsError } = customerIds.length > 0
    ? await supabase.from('jobs').select('customer_id').in('customer_id', customerIds)
    : { data: [], error: null };

  const errors = [countError?.message, listError?.message, totalError?.message, jobsError?.message, jobCountsError?.message];

  const countMap: Record<string, number> = {};
  jobCounts?.forEach(j => { countMap[j.customer_id] = (countMap[j.customer_id] || 0) + 1; });

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-eyebrow">Marketplace</div>
        <h1>Customers</h1>
        <p className="page-header-sub">All customers who have signed up on the Solid Connect platform.</p>
      </div>

      <ErrorBanner errors={errors} />

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Customers</div>
          <div className="stat-card-value">{allCustomers ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Jobs Posted</div>
          <div className="stat-card-value">{totalJobs ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avg Jobs per Customer</div>
          <div className="stat-card-value">
            {allCustomers && allCustomers > 0 ? ((totalJobs ?? 0) / allCustomers).toFixed(1) : '0'}
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <form>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search by name, email, or area..."
            className="search-input"
            style={{ maxWidth: 400 }}
          />
        </form>
        <a href={`/api/export/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="filter-btn">Export CSV</a>
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <SortHeader label="Customer" field="full_name" currentSort={sort} currentDir={dir} basePath="/customers" params={{ q }} />
              <SortHeader label="Area" field="area" currentSort={sort} currentDir={dir} basePath="/customers" params={{ q }} />
              <th>Phone</th>
              <th>Jobs Posted</th>
              <SortHeader label="Joined" field="created_at" currentSort={sort} currentDir={dir} basePath="/customers" params={{ q }} />
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                      {c.initials}
                    </div>
                    <div>
                      <Link href={`/customers/${c.id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{c.full_name}</Link>
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
      <Pagination page={page} pageSize={PAGE_SIZE} total={total ?? 0} basePath="/customers" params={{ q }} />
    </>
  );
}
