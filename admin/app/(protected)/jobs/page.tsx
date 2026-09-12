import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { SortHeader } from '../../components/SortHeader';

type Props = { searchParams: Promise<{ status?: string; q?: string; page?: string; sort?: string; dir?: string }> };
const statuses = ['all', 'in_progress', 'completed'];
const statusLabels: Record<string, string> = { all: 'All', in_progress: 'In Progress', completed: 'Completed' };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const currency = (n: number) => `GH₵${n.toLocaleString('en-US')}`;

/** Strips characters that would break a PostgREST .or()/.ilike() filter string. */
const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();
const SORTABLE = ['title', 'price', 'location_label', 'status', 'started_at'];

export default async function JobsPage({ searchParams }: Props) {
  const { status: requested, q, page: pageRaw, sort: sortRaw, dir: dirRaw } = await searchParams;
  const status = statuses.includes(requested ?? '') ? requested! : 'all';
  const requestedPage = parsePage(pageRaw);
  const sort = SORTABLE.includes(sortRaw ?? '') ? sortRaw! : 'started_at';
  const dir: 'asc' | 'desc' = dirRaw === 'asc' ? 'asc' : 'desc';
  const supabase = await createServerSupabase();
  const term = q ? sanitizeForFilter(q) : '';

  // Two separate builders rather than one branching on a flag: a ternary
  // between two differently-selected queries collapses TS's inferred row
  // type to their common subset ({id}), breaking property access below.
  const countQuery = () => {
    let q2 = supabase.from('jobs').select('id', { count: 'exact', head: true });
    if (status !== 'all') q2 = q2.eq('status', status);
    if (term) q2 = q2.or(`title.ilike.%${term}%,location_label.ilike.%${term}%`);
    return q2;
  };
  const dataQuery = () => {
    let q2 = supabase.from('jobs').select('id, title, price, location_label, status, started_at, completed_at, customer_id, provider_id');
    if (status !== 'all') q2 = q2.eq('status', status);
    if (term) q2 = q2.or(`title.ilike.%${term}%,location_label.ilike.%${term}%`);
    return q2;
  };

  // Stat cards reflect the selected status tab (matching the tabs
  // themselves) but not the search box - counted independently of the
  // current page so they stay correct once the table is paginated.
  const withTab = () => {
    let q2 = supabase.from('jobs').select('*', { count: 'exact', head: true });
    if (status !== 'all') q2 = q2.eq('status', status);
    return q2;
  };
  // Completed jobs within the current tab (narrow single-column fetch, just
  // to sum price client-side - PostgREST has no server-side SUM here).
  const revenueQuery = () => {
    let q2 = supabase.from('jobs').select('price');
    if (status !== 'all') q2 = q2.eq('status', status);
    return q2.eq('status', 'completed');
  };

  const [
    { count: filteredTotal, error: countError },
    { count: totalCount, error: totalError },
    { count: completedCount, error: completedError },
    { count: inProgressCount, error: inProgressError },
    { data: completedPrices, error: revenueError },
  ] = await Promise.all([
    countQuery(),
    withTab(),
    withTab().eq('status', 'completed'),
    withTab().eq('status', 'in_progress'),
    revenueQuery(),
  ]);

  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: jobs, error: listError } = await dataQuery().order(sort, { ascending: dir === 'asc' }).range(from, to);

  const errors = [countError?.message, listError?.message, totalError?.message, completedError?.message, inProgressError?.message, revenueError?.message];

  const filtered = jobs ?? [];
  const totalRevenue = (completedPrices ?? []).reduce((s, j) => s + (j.price ?? 0), 0);
  const avgPrice = (completedCount ?? 0) > 0 ? totalRevenue / (completedCount ?? 1) : 0;

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

      <ErrorBanner errors={errors} />

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Jobs</div>
          <div className="stat-card-value">{totalCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Completed</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{completedCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">In Progress</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{inProgressCount ?? 0}</div>
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
          <input type="hidden" name="status" value={status} />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search jobs..."
            className="search-input"
            style={{ width: 240 }}
          />
        </form>
        <a href={`/api/export/jobs?${new URLSearchParams({ status, ...(q ? { q } : {}) }).toString()}`} className="filter-btn">Export CSV</a>
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <SortHeader label="Job" field="title" currentSort={sort} currentDir={dir} basePath="/jobs" params={{ status, q }} />
              <th>Provider</th>
              <th>Customer</th>
              <SortHeader label="Price" field="price" currentSort={sort} currentDir={dir} basePath="/jobs" params={{ status, q }} />
              <SortHeader label="Location" field="location_label" currentSort={sort} currentDir={dir} basePath="/jobs" params={{ status, q }} />
              <SortHeader label="Status" field="status" currentSort={sort} currentDir={dir} basePath="/jobs" params={{ status, q }} />
              <SortHeader label="Date" field="started_at" currentSort={sort} currentDir={dir} basePath="/jobs" params={{ status, q }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(j => {
              const prov = providerMap[j.provider_id];
              const cust = customerMap[j.customer_id];
              return (
                <tr key={j.id}>
                  <td><Link href={`/jobs/${j.id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{j.title || 'Untitled'}</Link></td>
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
      <Pagination page={page} pageSize={PAGE_SIZE} total={total ?? 0} basePath="/jobs" params={{ status, q }} />
    </>
  );
}
