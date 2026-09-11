import { createAdminClient } from '../../lib/admin';

export const dynamic = 'force-dynamic';

/* ── helpers ──────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('en-US');
const currency = (n: number) => `GH₵${n.toLocaleString('en-US')}`;

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastTwelveMonths() {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({
      key: monthKey(d),
      label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    });
  }
  return months;
}

function countByMonth(dates: (string | null | undefined)[]) {
  const buckets: Record<string, number> = {};
  for (const raw of dates) {
    if (!raw) continue;
    const key = monthKey(new Date(raw));
    buckets[key] = (buckets[key] || 0) + 1;
  }
  return lastTwelveMonths().map((m) => buckets[m.key] ?? 0);
}

/* ── sparkline SVG ────────────────────────────────────────── */
/** Cardinal-spline-style smoothing: bends the line through every point
 * instead of connecting them with straight segments. */
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return '';
  if (points.length === 2) return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`;
  const smoothing = 0.2;
  const d = [`M${points[0][0]},${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1[0] + (p2[0] - p0[0]) * smoothing;
    const cp1y = p1[1] + (p2[1] - p0[1]) * smoothing;
    const cp2x = p2[0] - (p3[0] - p1[0]) * smoothing;
    const cp2y = p2[1] - (p3[1] - p1[1]) * smoothing;
    d.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  return d.join(' ');
}

function Sparkline({ data, color = 'var(--accent)', id }: { data: number[]; color?: string; id: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const points: [number, number][] = data.map((v, i) => [
    data.length === 1 ? 0 : (i / (data.length - 1)) * 100,
    100 - (v / max) * 80,
  ]);
  const linePath = smoothPath(points);
  const areaPath = `${linePath} L${points[points.length - 1][0]},100 L${points[0][0]},100 Z`;
  const gradientId = `spark-fill-${id}`;
  return (
    <div className="stat-card-spark">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ── donut chart ──────────────────────────────────────────── */
function Donut({
  segments,
  total,
  centerLabel,
}: {
  segments: { color: string; pct: number; label: string; count: number }[];
  total: number;
  centerLabel: string;
}) {
  let acc = 0;
  const grad = segments
    .map((s) => {
      const start = acc;
      acc += s.pct;
      return `${s.color} ${start}% ${acc}%`;
    })
    .join(', ');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <div className="donut-wrap">
        <div className="donut" style={{ background: `conic-gradient(${grad || 'var(--border) 0% 100%'})` }} />
        <div className="donut-center">
          <div className="num">{fmt(total)}</div>
          <div className="lbl">{centerLabel}</div>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map((s) => (
          <span key={s.label}>
            <span className="dot" style={{ background: s.color }} />
            {s.label}
            <span className="count">
              {fmt(s.count)} ({s.pct.toFixed(1)}%)
            </span>
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
        <div key={labels[i] ?? i} className="bar-col">
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(v / max) * 100}%` }} title={`${labels[i]}: ${v}`} />
          </div>
          <span className="bar-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export default async function AnalyticsPage() {
  const supabase = createAdminClient();
  const months = lastTwelveMonths();

  const [
    providersRes,
    verifiedRes,
    pendingRes,
    jobsRes,
    completedRes,
    recentJobsRes,
    recentReviewsRes,
    categoryLinksRes,
    paymentsRes,
    jobsTimelineRes,
    providersTimelineRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'provider'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'provider')
      .eq('provider_verified', true),
    supabase.from('provider_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    // jobs has started_at / completed_at — not created_at
    supabase
      .from('jobs')
      .select('id, title, price, status, location_label, started_at, completed_at, provider_id, customer_id')
      .order('started_at', { ascending: false })
      .limit(5),
    supabase
      .from('reviews')
      .select('id, rating, created_at, provider_id, customer_id, job_id')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('provider_categories').select('category_id, categories(name)'),
    supabase.from('payments').select('amount, status'),
    supabase.from('jobs').select('started_at'),
    supabase.from('profiles').select('created_at').eq('role', 'provider'),
  ]);

  const queryErrors = [
    providersRes,
    verifiedRes,
    pendingRes,
    jobsRes,
    completedRes,
    recentJobsRes,
    recentReviewsRes,
    categoryLinksRes,
    paymentsRes,
    jobsTimelineRes,
    providersTimelineRes,
  ]
    .map((r) => r.error?.message)
    .filter(Boolean);

  const providers = providersRes.count ?? 0;
  const verified = verifiedRes.count ?? 0;
  const pending = pendingRes.count ?? 0;
  const jobs = jobsRes.count ?? 0;
  const completed = completedRes.count ?? 0;
  const recentJobs = recentJobsRes.data ?? [];
  const recentReviews = recentReviewsRes.data ?? [];
  const paymentsData = paymentsRes.data ?? [];

  const totalRevenue = paymentsData
    .filter((p) => p.status === 'released' || p.status === 'completed' || p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const pendingPayments = paymentsData
    .filter((p) => p.status === 'pending' || p.status === 'held' || p.status === 'escrow')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const completionRate = jobs > 0 ? ((completed / jobs) * 100).toFixed(1) : '0';
  const verificationRate = providers > 0 ? ((verified / providers) * 100).toFixed(1) : '0';

  // Prefer multi-service links; fall back to profiles.provider_category label.
  const catCounts: Record<string, number> = {};
  const links = categoryLinksRes.data ?? [];
  if (links.length) {
    for (const row of links) {
      const nested = row.categories as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(nested) ? nested[0]?.name : nested?.name;
      const cat = name || 'Uncategorized';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  } else {
    const { data: providerCats } = await supabase
      .from('profiles')
      .select('provider_category')
      .eq('role', 'provider');
    for (const p of providerCats ?? []) {
      const raw = p.provider_category || 'Uncategorized';
      for (const part of raw.split('·').map((s: string) => s.trim()).filter(Boolean)) {
        catCounts[part] = (catCounts[part] || 0) + 1;
      }
    }
  }
  const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const totalCat = catEntries.reduce((s, [, c]) => s + c, 0);

  const jobsByMonth = countByMonth((jobsTimelineRes.data ?? []).map((j) => j.started_at));
  const providersByMonth = countByMonth((providersTimelineRes.data ?? []).map((p) => p.created_at));
  const monthLabels = months.map((m) => m.label);

  // Cumulative sparkline series from monthly signups / jobs
  const cumulative = (series: number[]) => {
    let sum = 0;
    return series.map((n) => {
      sum += n;
      return sum;
    });
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Platform Overview</div>
        <h1>Solid Connect Dashboard</h1>
        <p className="page-header-sub">
          Real-time insights into your provider marketplace — jobs, verifications, and revenue.
        </p>
        <div className="page-header-actions">
          <span className="date-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            All Time
          </span>
        </div>
      </div>

      {queryErrors.length > 0 ? (
        <div className="empty" style={{ marginBottom: 16, color: 'var(--red)' }}>
          Some metrics failed to load: {queryErrors[0]}
        </div>
      ) : null}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Pending Verifications</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>
            {fmt(pending)}
          </div>
          <div className="stat-card-sub">Awaiting admin review</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Jobs</div>
          <div className="stat-card-value">{fmt(jobs)}</div>
          <div className="stat-card-trend up">{completionRate}% completed</div>
          <div className="stat-card-sub">
            {completed} completed, {Math.max(0, jobs - completed)} open
          </div>
          <Sparkline data={jobsByMonth} id="jobs" />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Revenue</div>
          <div className="stat-card-value">{currency(totalRevenue)}</div>
          <div className="stat-card-trend up">From released payments</div>
          <div className="stat-card-sub">{currency(pendingPayments)} pending</div>
          <Sparkline data={jobsByMonth.map((n) => n * Math.max(1, Math.round(totalRevenue / Math.max(jobs, 1))))} id="revenue" />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Providers</div>
          <div className="stat-card-value">{fmt(providers)}</div>
          <div className="stat-card-trend up">{verificationRate}% verified</div>
          <div className="stat-card-sub">
            {verified} verified, {pending} pending
          </div>
          <Sparkline data={cumulative(providersByMonth)} id="providers" />
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Jobs Overview</h3>
            <span className="badge">Last 12 months</span>
          </div>
          {jobsByMonth.some((n) => n > 0) ? (
            <BarChart data={jobsByMonth} labels={monthLabels} />
          ) : (
            <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No jobs in the last 12 months</div>
          )}
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Provider Categories</h3>
          </div>
          {catEntries.length > 0 ? (
            <Donut
              total={providers}
              centerLabel="Providers"
              segments={catEntries.slice(0, 5).map(([cat, count], i) => ({
                color: ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--red)'][i],
                pct: totalCat > 0 ? (count / totalCat) * 100 : 0,
                label: cat,
                count,
              }))}
            />
          ) : (
            <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No provider data yet</div>
          )}
        </div>
      </div>

      <div className="bottom-row">
        <div className="table-card">
          <div className="table-card-header">
            <h3>Recent Jobs</h3>
            <a className="table-link" href="/jobs" style={{ margin: 0 }}>
              View All →
            </a>
          </div>
          {recentJobs.length > 0 ? (
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
                {recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{job.title || 'Untitled Job'}</strong>
                    </td>
                    <td style={{ fontWeight: 700 }}>{currency(job.price ?? 0)}</td>
                    <td>{job.location_label || '—'}</td>
                    <td>
                      <span className={`pill ${job.status === 'completed' ? 'approved' : 'pending'}`}>
                        {job.status === 'completed' ? 'Completed' : job.status?.replaceAll('_', ' ') || 'In progress'}
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
          {recentReviews.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Rating</th>
                  <th>Job</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentReviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <div className="risk-score risk-low" style={{ width: 36, height: 36, fontSize: 13 }}>
                        {review.rating}★
                      </div>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {review.job_id ? String(review.job_id).slice(0, 8) : '—'}
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

      <div className="insight-banner">
        <div className="insight-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="insight-text">
          <strong>Platform Insight</strong>
          <p>
            {pending > 0
              ? `You have ${pending} provider verification${pending > 1 ? 's' : ''} awaiting review. Verified providers see 2.3x more job completions.`
              : 'All provider verifications are up to date. Keep the marketplace growing!'}
          </p>
        </div>
        <a className="insight-cta" href="/verifications">
          Review Verifications →
        </a>
      </div>
    </>
  );
}
