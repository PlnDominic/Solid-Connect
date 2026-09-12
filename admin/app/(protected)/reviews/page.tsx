import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';

type Props = { searchParams: Promise<{ rating?: string; page?: string }> };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function ReviewsPage({ searchParams }: Props) {
  const { rating, page: pageRaw } = await searchParams;
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();

  // Two separate builders rather than one branching on a flag: a ternary
  // between two differently-selected queries collapses TS's inferred row
  // type to their common subset ({id}), breaking property access below.
  const countQuery = () => {
    let q2 = supabase.from('reviews').select('id', { count: 'exact', head: true });
    if (rating) q2 = q2.eq('rating', Number(rating));
    return q2;
  };
  const dataQuery = () => {
    let q2 = supabase.from('reviews').select('id, rating, created_at, provider_id, customer_id, job_id');
    if (rating) q2 = q2.eq('rating', Number(rating));
    return q2;
  };

  // Rating distribution as 5 independent counts rather than fetching every
  // review row - stays cheap and exact regardless of table size, and gives
  // an exact average (sum(stars*count)/total) without a row fetch either.
  const starCount = (stars: number) =>
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('rating', stars);

  const [
    { count: filteredTotal, error: countError },
    { count: c5, error: e5 },
    { count: c4, error: e4 },
    { count: c3, error: e3 },
    { count: c2, error: e2 },
    { count: c1, error: e1 },
  ] = await Promise.all([
    countQuery(),
    starCount(5),
    starCount(4),
    starCount(3),
    starCount(2),
    starCount(1),
  ]);

  const filteredCount = filteredTotal ?? 0;
  const page = clampPage(requestedPage, filteredCount, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: reviews, error: listError } = await dataQuery().order('created_at', { ascending: false }).range(from, to);

  const errors = [countError?.message, listError?.message, e5?.message, e4?.message, e3?.message, e2?.message, e1?.message];

  const dist = [
    { stars: 5, count: c5 ?? 0 },
    { stars: 4, count: c4 ?? 0 },
    { stars: 3, count: c3 ?? 0 },
    { stars: 2, count: c2 ?? 0 },
    { stars: 1, count: c1 ?? 0 },
  ];
  const total = dist.reduce((s, d) => s + d.count, 0);
  const avgRating = total > 0 ? dist.reduce((s, d) => s + d.stars * d.count, 0) / total : 0;

  const filtered = reviews ?? [];

  // Get provider/customer names for the rows on this page
  const providerIds = [...new Set(filtered.map(r => r.provider_id).filter(Boolean))];
  const customerIds = [...new Set(filtered.map(r => r.customer_id).filter(Boolean))];

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
        <div className="page-header-eyebrow">Quality</div>
        <h1>Reviews</h1>
        <p className="page-header-sub">Customer reviews and ratings for service providers on Solid Connect.</p>
      </div>

      <ErrorBanner errors={errors} />

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Reviews</div>
          <div className="stat-card-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Average Rating</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>
            {avgRating.toFixed(1)} ★
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">5-Star Reviews</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>
            {dist[0].count}
          </div>
          <div className="stat-card-sub">
            {total > 0 ? ((dist[0].count / total) * 100).toFixed(0) : 0}% of all reviews
          </div>
        </div>
      </div>

      {/* Rating Distribution + Filter */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="chart-panel" style={{ flex: '1 1 300px' }}>
          <div className="chart-panel-header">
            <h3>Rating Distribution</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dist.map(d => {
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              return (
                <div key={d.stars} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, width: 20, textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {d.stars}★
                  </span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: 'var(--accent)', transition: 'width .4s' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 50 }}>{d.count} ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter */}
        <div className="chart-panel" style={{ flex: '0 0 200px' }}>
          <div className="chart-panel-header">
            <h3>Filter by Rating</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a
              href="/reviews"
              style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: !rating ? 'var(--accent-bg)' : 'transparent',
                color: !rating ? 'var(--accent)' : 'var(--text-secondary)',
                border: !rating ? '1px solid var(--accent-border)' : '1px solid transparent',
              }}
            >
              All Reviews
            </a>
            {[5, 4, 3, 2, 1].map(r => (
              <a
                key={r}
                href={`/reviews?rating=${r}`}
                style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: rating === String(r) ? 'var(--accent-bg)' : 'transparent',
                  color: rating === String(r) ? 'var(--accent)' : 'var(--text-secondary)',
                  border: rating === String(r) ? '1px solid var(--accent-border)' : '1px solid transparent',
                }}
              >
                {r}★ Reviews ({dist.find(d => d.stars === r)?.count ?? 0})
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Rating</th>
              <th>Provider</th>
              <th>Customer</th>
              <th>Job</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(r => {
              const prov = providerMap[r.provider_id];
              const cust = customerMap[r.customer_id];
              return (
                <tr key={r.id}>
                  <td>
                    <div className="risk-score risk-low" style={{ width: 36, height: 36, fontSize: 13 }}>
                      {r.rating}★
                    </div>
                  </td>
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
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                    {r.job_id ? String(r.job_id).slice(0, 8) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stamp(r.created_at)}</td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="empty">No reviews found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={filteredTotal ?? 0} basePath="/reviews" params={{ rating }} />
    </>
  );
}
