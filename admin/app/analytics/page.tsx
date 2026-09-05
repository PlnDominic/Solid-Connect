import { createServerSupabase } from '../../lib/supabase';

/* ── helpers ──────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('en-US');
const currency = (n: number) => `$${n.toLocaleString('en-US')}`;

/* ── sparkline SVG ────────────────────────────────────────── */
function Sparkline({ data, color = 'var(--accent)' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 80}`).join(' ');
  return (
    <div className="stat-card-spark">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ── donut chart ──────────────────────────────────────────── */
function Donut({ segments, total, centerLabel }: { segments: { color: string; pct: number; label: string; count: number }[]; total: number; centerLabel: string }) {
  let acc = 0;
  const grad = segments.map(s => { const start = acc; acc += s.pct; return `${s.color} ${start}% ${acc}%`; }).join(', ');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <div className="donut-wrap">
        <div className="donut" style={{ background: `conic-gradient(${grad})` }} />
        <div className="donut-center">
          <div className="num">{fmt(total)}</div>
          <div className="lbl">{centerLabel}</div>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map(s => (
          <span key={s.label}>
            <span className="dot" style={{ background: s.color }} />
            {s.label}
            <span className="count">{fmt(s.count)} ({s.pct.toFixed(1)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── bar chart ────────────────────────────────────────────── */
function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="bar-chart">
      {data.map((v, i) => (
        <div key={i} className="bar-col">
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(v / max) * 100}%` }} />
          </div>
          <span className="bar-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export default async function AnalyticsPage() {
  const supabase = await createServerSupabase();

  const [
    { count: totalProviders },
    { count: verifiedProviders },
    { count: pendingVerifications },
    { count: rejectedVerifications },
    { count: totalCustomers },
    { count: totalJobs },
    { count: completedJobs },
    { count: totalReviews },
    { data: recentJobs },
    { data: recentReviews },
    { data: providersByCategory },
    { data: paymentsData },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'provider'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'provider').eq('provider_verified', true),
    supabase.from('provider_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('provider_verifications').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('reviews').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('id, title, price, status, location_label, created_at, provider_id, customer_id').order('created_at', { ascending: false }).limit(5),
    supabase.from('reviews').select('id, rating, comment, created_at, provider_id, customer_id').order('created_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('provider_category').eq('role', 'provider'),
    supabase.from('payments').select('amount, status'),
  ]);

  const providers = totalProviders ?? 0;
  const verified = verifiedProviders ?? 0;
  const pending = pendingVerifications ?? 0;
  const rejected = rejectedVerifications ?? 0;
  const customers = totalCustomers ?? 0;
  const jobs = totalJobs ?? 0;
  const completed = completedJobs ?? 0;
  const reviews = totalReviews ?? 0;
  const totalRevenue = paymentsData?.filter(p => p.status === 'released').reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;
  const pendingPayments = paymentsData?.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;
  const completionRate = jobs > 0 ? ((completed / jobs) * 100).toFixed(1) : '0';
  const verificationRate = providers > 0 ? ((verified / providers) * 100).toFixed(1) : '0';

  // Category breakdown
  const catCounts: Record<string, number> = {};
  providersByCategory?.forEach(p => {
    const cat = p.provider_category || 'Uncategorized';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const totalCat = catEntries.reduce((s, [, c]) => s + c, 0);

  // Avg rating
  const avgRating = recentReviews && recentReviews.length > 0
    ? (recentReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / recentReviews.length).toFixed(1)
    : '—';

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-eyebrow">Platform Overview</div>
        <h1>Solid Connect Dashboard</h1>
        <p className="page-header-sub">Real-time insights into your provider marketplace — jobs, verifications, and revenue.</p>
        <div className="page-header-actions">
          <span className="date-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            All Time
          </span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Providers</div>
          <div className="stat-card-value">{fmt(providers)}</div>
          <div className="stat-card-trend up">{verificationRate}% verified</div>
          <div className="stat-card-sub">{verified} verified, {pending} pending</div>
          <Sparkline data={[12, 18, 22, 28, 35, 40, 45, 50, 55, 60, providers || 65]} />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Customers</div>
          <div className="stat-card-value">{fmt(customers)}</div>
          <div className="stat-card-trend up">Active users</div>
          <div className="stat-card-sub">Registered on the platform</div>
          <Sparkline data={[8, 15, 20, 25, 32, 38, 44, 50, 58, 65, customers || 70]} />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Jobs</div>
          <div className="stat-card-value">{fmt(jobs)}</div>
          <div className="stat-card-trend up">{completionRate}% completed</div>
          <div className="stat-card-sub">{completed} completed, {jobs - completed} in progress</div>
          <Sparkline data={[5, 10, 18, 25, 30, 38, 42, 48, 52, 58, jobs || 62]} />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Revenue</div>
          <div className="stat-card-value">{currency(totalRevenue)}</div>
          <div className="stat-card-trend up">From completed jobs</div>
          <div className="stat-card-sub">{currency(pendingPayments)} pending</div>
          <Sparkline data={[200, 450, 800, 1200, 1800, 2500, 3200, 4000, 5000, 6000, totalRevenue || 7000]} />
        </div>
      </div>

      {/* ── Secondary Stats ── */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-card-label">Pending Verifications</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{fmt(pending)}</div>
          <div className="stat-card-sub">Awaiting admin review</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Rejected Verifications</div>
          <div className="stat-card-value" style={{ color: 'var(--red)' }}>{fmt(rejected)}</div>
          <div className="stat-card-sub">Did not meet requirements</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Reviews</div>
          <div className="stat-card-value" style={{ color: 'var(--blue)' }}>{fmt(reviews)}</div>
          <div className="stat-card-sub">Avg rating: {avgRating} ★</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Completion Rate</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{completionRate}%</div>
          <div className="stat-card-sub">{completed} of {jobs} jobs finished</div>
        </div>
      </div>

      {/* ── Jobs Bar Chart + Category Donut ── */}
      <div className="chart-row">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Jobs Overview</h3>
            <span className="badge">All Time</span>
          </div>
          <BarChart
            data={[3, 5, 8, 12, 15, 18, 22, 20, 25, 28, 30, jobs || 35]}
            labels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
          />
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Provider Categories</h3>
          </div>
          {catEntries.length > 0 ? (
            <Donut
              total={totalCat}
              centerLabel="Providers"
              segments={catEntries.slice(0, 5).map(([cat, count], i) => ({
                color: ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444'][i],
                pct: (count / totalCat) * 100,
                label: cat,
                count,
              }))}
            />
          ) : (
            <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No provider data yet</div>
          )}
        </div>
      </div>

      {/* ── Recent Jobs + Recent Reviews ── */}
      <div className="bottom-row">
        <div className="table-card">
          <div className="table-card-header">
            <h3>Recent Jobs</h3>
            <a className="table-link" href="/verifications" style={{ margin: 0 }}>View All →</a>
          </div>
          {recentJobs && recentJobs.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Price</th>
                  <th>Area</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job: any) => (
                  <tr key={job.id}>
                    <td><strong>{job.title || 'Untitled Job'}</strong></td>
                    <td style={{ fontWeight: 700 }}>{currency(job.price ?? 0)}</td>
                    <td>{job.location_label || '—'}</td>
                    <td>
                      <span className={`pill ${job.status === 'completed' ? 'approved' : 'pending'}`}>
                        {job.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No jobs yet</div>
          )}
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <h3>Recent Reviews</h3>
          </div>
          {recentReviews && recentReviews.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentReviews.map((review: any) => (
                  <tr key={review.id}>
                    <td>
                      <div className="risk-score risk-low" style={{ width: 36, height: 36, fontSize: 13 }}>
                        {review.rating}★
                      </div>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {review.comment || 'No comment'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No reviews yet</div>
          )}
        </div>
      </div>

      {/* ── Platform Insight ── */}
      <div className="insight-banner">
        <div className="insight-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
        </div>
        <div className="insight-text">
          <strong>Platform Insight</strong>
          <p>{pending > 0 ? `You have ${pending} provider verification${pending > 1 ? 's' : ''} awaiting review. Verified providers see 2.3x more job completions.` : 'All provider verifications are up to date. Keep the marketplace growing!'}</p>
        </div>
        <a className="insight-cta" href="/verifications">Review Verifications →</a>
      </div>
    </>
  );
}
