import { createServerSupabase } from '../../lib/supabase';

type Props = { searchParams: Promise<{ rating?: string }> };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function ReviewsPage({ searchParams }: Props) {
  const { rating } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: reviews, count: total } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, provider_id, customer_id')
    .order('created_at', { ascending: false });

  let filtered = reviews ?? [];
  if (rating) {
    filtered = filtered.filter(r => r.rating === Number(rating));
  }

  // Rating distribution
  const allReviews = reviews ?? [];
  const dist = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: allReviews.filter(rev => rev.rating === r).length,
  }));
  const avgRating = allReviews.length > 0
    ? (allReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / allReviews.length)
    : 0;

  // Get provider/customer names
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

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Total Reviews</div>
          <div className="stat-card-value">{total ?? 0}</div>
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
            {total && total > 0 ? ((dist[0].count / total) * 100).toFixed(0) : 0}% of all reviews
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
              const pct = total && total > 0 ? (d.count / total) * 100 : 0;
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
              <th>Comment</th>
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
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.comment || <span style={{ color: 'var(--text-muted)' }}>No comment</span>}
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
    </>
  );
}
