import { createAdminClient } from '../../../lib/admin';

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

function Sparkline({
  data,
  labels,
  color = 'var(--accent)',
  id,
  format = fmt,
  unit,
}: {
  data: number[];
  labels: string[];
  color?: string;
  id: string;
  format?: (n: number) => string;
  unit: string;
}) {
  if (!data.length) return null;
  const W = 240;
  const H = 84;
  const pad = { l: 4, r: 8, t: 10, b: 6 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...data, 1);
  const x = (i: number) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const points: [number, number][] = data.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(points);
  const base = pad.t + ih;
  const area = `${line} L${points[points.length - 1][0]},${base} L${points[0][0]},${base} Z`;
  const last = points[points.length - 1];
  const gradientId = `spark-fill-${id}`;
  const peak = Math.max(...data);
  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${unit} over the last ${data.length} months`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={pad.t + ih * g} y2={pad.t + ih * g} stroke="var(--border)" strokeDasharray={g === 1 ? undefined : '3 4'} strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="7" fill={color} opacity="0.18" />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--bg-card)" stroke={color} strokeWidth="2.25" />
        {points.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r="7" fill="transparent">
            <title>{`${labels[i]}: ${format(data[i])}`}</title>
          </circle>
        ))}
      </svg>
      <div className="trend-axis">
        <span>{labels[0]}</span>
        <span>Peak {format(peak)}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

/* ── ring gauge (stat card) ───────────────────────────────── */
function Ring({ pct, color = 'var(--accent)', label }: { pct: number; color?: string; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="ring" role="img" aria-label={`${label}: ${clamped.toFixed(0)}%`}>
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-input)" strokeWidth="7" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`} transform="rotate(-90 32 32)"
        />
      </svg>
      <span>{clamped.toFixed(0)}%</span>
    </div>
  );
}

/* ── mini bars (stat card) ────────────────────────────────── */
function MiniBars({ data, color = 'var(--accent)' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="mini-bars" aria-hidden="true">
      {data.map((v, i) => (
        <span
          key={i}
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: color, opacity: i === data.length - 1 ? 1 : 0.35 + (i / data.length) * 0.4 }}
        />
      ))}
    </div>
  );
}

/* ── area / line chart with axes ──────────────────────────── */
function AreaChart({
  series,
  labels,
}: {
  series: { data: number[]; color: string; label: string }[];
  labels: string[];
}) {
  const W = 640;
  const H = 240;
  const pad = { l: 34, r: 10, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const rawMax = Math.max(...series.flatMap((s) => s.data), 1);
  const step = rawMax <= 4 ? 1 : Math.ceil(rawMax / 4);
  const max = step * 4;
  const x = (i: number) => pad.l + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  return (
    <div>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="area-chart" role="img" aria-label={series.map((s) => s.label).join(' and ')}>
        <defs>
          {series.map((s, idx) => (
            <linearGradient key={idx} id={`area-fill-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 1, 2, 3, 4].map((g) => {
          const gv = step * g;
          return (
            <g key={g}>
              <line x1={pad.l} x2={W - pad.r} y1={y(gv)} y2={y(gv)} stroke="var(--border)" strokeDasharray={g === 0 ? undefined : '3 4'} />
              <text x={pad.l - 8} y={y(gv) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)">{gv}</text>
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--text-muted)">{l}</text>
        ))}
        {series.map((s, idx) => {
          const pts: [number, number][] = s.data.map((v, i) => [x(i), y(v)]);
          const line = smoothPath(pts);
          const area = `${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`;
          const last = pts[pts.length - 1];
          return (
            <g key={idx}>
              {idx === 0 ? <path d={area} fill={`url(#area-fill-${idx})`} /> : null}
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={idx === 0 ? undefined : '6 5'} />
              <circle cx={last[0]} cy={last[1]} r="4.5" fill="var(--bg-card)" stroke={s.color} strokeWidth="2.5" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── semicircle gauge ─────────────────────────────────────── */
function Gauge({ pct, value, caption }: { pct: number; value: string; caption: string }) {
  const r = 80;
  const c = Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const arc = `M 20 100 A ${r} ${r} 0 0 1 180 100`;
  return (
    <div className="gauge" role="img" aria-label={`${caption}: ${value}`}>
      <svg viewBox="0 0 200 112">
        <path d={arc} fill="none" stroke="var(--bg-input)" strokeWidth="16" strokeLinecap="round" />
        <path d={arc} fill="none" stroke="var(--accent)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(clamped / 100) * c} ${c}`} />
      </svg>
      <div className="gauge-value">{value}</div>
      <div className="gauge-caption">{caption}</div>
    </div>
  );
}

/* ── ranked horizontal bars ───────────────────────────────── */
function HBars({ entries, total }: { entries: { label: string; count: number; color: string }[]; total: number }) {
  const max = Math.max(...entries.map((e) => e.count), 1);
  return (
    <div className="hbars">
      {entries.map((e) => (
        <div key={e.label} className="hbar">
          <div className="hbar-head">
            <span>{e.label}</span>
            <span className="hbar-count">
              {fmt(e.count)} <em>{total > 0 ? ((e.count / total) * 100).toFixed(0) : 0}%</em>
            </span>
          </div>
          <div className="hbar-track">
            <div style={{ width: `${(e.count / max) * 100}%`, background: e.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── column chart ─────────────────────────────────────────── */
function BarChart({ data, labels, color = 'var(--accent)' }: { data: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="bar-chart">
      {data.map((v, i) => (
        <div key={labels[i] ?? i} className="bar-col">
          <span className="bar-value">{v > 0 ? v : ''}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(v / max) * 100}%`, background: color }} title={`${labels[i]}: ${v}`} />
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
  const windowStart = `${months[0].key}-01T00:00:00Z`;

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
    areaCoverageRes,
    usersRes,
    customersRes,
    openRequestsRes,
    activeJobsRes,
    openDisputesRes,
    commissionRes,
    payoutCommissionRes,
    organizationsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'provider'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
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
    supabase.rpc('admin_dashboard_money', { p_since: windowStart }),
    supabase.from('jobs').select('started_at').gte('started_at', windowStart),
    supabase.from('profiles').select('created_at').eq('role', 'provider').gte('created_at', windowStart),
    supabase.rpc('admin_area_coverage'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'matching', 'awaiting_provider', 'quoted']),
    supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['accepted', 'in_progress', 'awaiting_completion_confirmation']),
    supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('platform_config').select('commission_percent').eq('id', true).maybeSingle(),
    supabase.from('provider_payouts').select('commission_amount'),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
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
    areaCoverageRes,
    usersRes,
    customersRes,
    openRequestsRes,
    activeJobsRes,
    openDisputesRes,
    commissionRes,
    payoutCommissionRes,
    organizationsRes,
  ]
    .map((r) => r.error?.message)
    .filter(Boolean);

  const providers = providersRes.count ?? 0;
  const organizations = organizationsRes.count ?? 0;
  const verified = verifiedRes.count ?? 0;
  const pending = pendingRes.count ?? 0;
  const jobs = jobsRes.count ?? 0;
  const completed = completedRes.count ?? 0;
  const registeredUsers = usersRes.count ?? 0;
  const customers = customersRes.count ?? 0;
  const openRequests = openRequestsRes.count ?? 0;
  const activeJobs = activeJobsRes.count ?? 0;
  const openDisputes = openDisputesRes.count ?? 0;
  const commissionPercent = Number(commissionRes.data?.commission_percent ?? 15);
  const platformCommission = (payoutCommissionRes.data ?? []).reduce(
    (sum, row) => sum + (Number((row as { commission_amount?: number }).commission_amount) || 0),
    0,
  );
  const recentJobs = recentJobsRes.data ?? [];
  const recentReviews = recentReviewsRes.data ?? [];
  const reviewJobIds = [...new Set(recentReviews.map((r) => r.job_id).filter(Boolean))] as string[];
  const { data: reviewJobs } = reviewJobIds.length
    ? await supabase.from('jobs').select('id, title').in('id', reviewJobIds)
    : { data: [] as { id: string; title: string | null }[] };
  const jobTitleById = Object.fromEntries((reviewJobs ?? []).map((j) => [j.id, j.title]));
  const money = (paymentsRes.data ?? { released_total: 0, pending_total: 0, by_month: [] }) as {
    released_total: number;
    pending_total: number;
    by_month: { month: string; amount: number }[];
  };
  const totalRevenue = Number(money.released_total) || 0;
  const pendingPayments = Number(money.pending_total) || 0;
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

  const revenueBuckets: Record<string, number> = Object.fromEntries(
    money.by_month.map((row) => [row.month, Number(row.amount) || 0]),
  );
  const revenueByMonth = months.map((m) => revenueBuckets[m.key] ?? 0);

  // Cumulative sparkline series from monthly signups / jobs
  const cumulative = (series: number[]) => {
    let sum = 0;
    return series.map((n) => {
      sum += n;
      return sum;
    });
  };

  // Coverage by area: bucket free-text area/location_label strings against
  // the known area_centroids names (the same list used for matching) by
  // whether the area name leads the string - "Achimota, Accra" matches
  // "Achimota". Areas with high demand and low supply are the actionable
  // signal here, so the table sorts by that ratio, worst first.
  const coverage = ((areaCoverageRes.data ?? []) as { area: string; supply: number; demand: number }[])
    .map(({ area, supply, demand }) => ({
      area,
      supply: Number(supply),
      demand: Number(demand),
      ratio: Number(demand) / Math.max(Number(supply), 1),
    }))
    .sort((a, b) => b.ratio - a.ratio);

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Platform Overview</div>
        <h1>Solid Connect Dashboard</h1>
        <p className="page-header-sub">
          Real-time insights into your provider marketplace: jobs, verifications, and revenue.
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

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-card-label">Registered users</div>
          <div className="stat-card-value">{fmt(registeredUsers)}</div>
          <div className="stat-card-sub">{fmt(customers)} customers · {fmt(providers)} providers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Open requests</div>
          <div className="stat-card-value">{fmt(openRequests)}</div>
          <div className="stat-card-sub">Matching, quoted, or awaiting a provider</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Active jobs</div>
          <div className="stat-card-value">{fmt(activeJobs)}</div>
          <div className="stat-card-sub">{fmt(completed)} completed all-time</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Open disputes</div>
          <div className="stat-card-value">{fmt(openDisputes)}</div>
          <div className="stat-card-sub">Needs admin resolution</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Platform commission</div>
          <div className="stat-card-value">{currency(platformCommission)}</div>
          <div className="stat-card-sub">From payouts at {commissionPercent}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Verified providers</div>
          <div className="stat-card-value">{fmt(verified)}</div>
          <div className="stat-card-sub">{fmt(pending)} verification pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Organizations</div>
          <div className="stat-card-value">{fmt(organizations)}</div>
          <div className="stat-card-sub">Active business accounts</div>
        </div>
      </div>

      <div className="stats-grid dash-stats">
        <div className="stat-card viz-card">
          <div className="viz-head">
            <div className="stat-card-label">Pending Verifications</div>
            <span className="viz-icon" style={{ background: 'var(--accent-secondary-bg)', color: 'var(--accent-secondary-text)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" /></svg>
            </span>
          </div>
          <div className="viz-body">
            <div>
              <div className="stat-card-value">{fmt(pending)}</div>
              <div className="stat-card-sub">Awaiting admin review</div>
            </div>
            <Ring pct={Number(verificationRate)} color="var(--green)" label="Providers verified" />
          </div>
          <div className="viz-foot">{verificationRate}% of providers verified</div>
        </div>
        <div className="stat-card viz-card">
          <div className="viz-head">
            <div className="stat-card-label">Total Jobs</div>
            <span className="viz-icon" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
            </span>
          </div>
          <div className="viz-body">
            <div>
              <div className="stat-card-value">{fmt(jobs)}</div>
              <div className="stat-card-sub">{completed} completed, {Math.max(0, jobs - completed)} open</div>
            </div>
            <MiniBars data={jobsByMonth} color="var(--blue)" />
          </div>
          <div className="viz-foot">{completionRate}% completion rate</div>
        </div>
        <div className="stat-card viz-card">
          <div className="viz-head">
            <div className="stat-card-label">Revenue</div>
            <span className="viz-icon" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>
            </span>
          </div>
          <div className="viz-body">
            <div>
              <div className="stat-card-value">{currency(totalRevenue)}</div>
              <div className="stat-card-sub">{currency(pendingPayments)} pending</div>
            </div>
          </div>
          <Sparkline data={revenueByMonth} labels={monthLabels} color="var(--green)" id="revenue" format={currency} unit="Revenue" />
          <div className="viz-foot">From released payments</div>
        </div>
        <div className="stat-card viz-card">
          <div className="viz-head">
            <div className="stat-card-label">Total Providers</div>
            <span className="viz-icon" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>
            </span>
          </div>
          <div className="viz-body">
            <div>
              <div className="stat-card-value">{fmt(providers)}</div>
              <div className="stat-card-sub">{verified} verified, {pending} pending</div>
            </div>
          </div>
          <Sparkline data={cumulative(providersByMonth)} labels={monthLabels} color="var(--purple)" id="providers" unit="Total providers" />
          <div className="viz-foot">Cumulative sign-ups, 12 months</div>
        </div>
      </div>

      <div className="chart-row">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Jobs and Sign-ups</h3>
            <span className="badge">Last 12 months</span>
          </div>
          {jobsByMonth.some((n) => n > 0) || providersByMonth.some((n) => n > 0) ? (
            <AreaChart
              labels={monthLabels}
              series={[
                { data: jobsByMonth, color: 'var(--accent)', label: 'Jobs started' },
                { data: providersByMonth, color: 'var(--purple)', label: 'New providers' },
              ]}
            />
          ) : (
            <div className="empty-note">No activity in the last 12 months</div>
          )}
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Job Completion</h3>
          </div>
          <Gauge pct={Number(completionRate)} value={`${completionRate}%`} caption={`${completed} of ${fmt(jobs)} jobs completed`} />
          <div className="gauge-legend">
            <span><i style={{ background: 'var(--accent)' }} />Completed <b>{fmt(completed)}</b></span>
            <span><i style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }} />Open <b>{fmt(Math.max(0, jobs - completed))}</b></span>
          </div>
        </div>
      </div>

      <div className="bottom-row" style={{ marginBottom: 16 }}>
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Provider Categories</h3>
            <span className="badge">{fmt(providers)} providers</span>
          </div>
          {catEntries.length > 0 ? (
            <HBars
              total={totalCat}
              entries={catEntries.slice(0, 6).map(([label, count], i) => ({
                label,
                count,
                color: ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--accent-secondary)', 'var(--red)'][i],
              }))}
            />
          ) : (
            <div className="empty-note">No provider data yet</div>
          )}
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Monthly Sign-ups</h3>
            <span className="badge">New providers</span>
          </div>
          {providersByMonth.some((n) => n > 0) ? (
            <BarChart data={providersByMonth} labels={monthLabels} color="var(--purple)" />
          ) : (
            <div className="empty-note">No sign-ups in the last 12 months</div>
          )}
        </div>
      </div>

      <div className="bottom-row">
        <div className="table-card">
          <div className="table-card-header">
            <h3>Recent Jobs</h3>
            <a className="table-link m-0" href="/jobs" >
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
                    <td className="fw-500">{currency(job.price ?? 0)}</td>
                    <td>{job.location_label || '-'}</td>
                    <td>
                      <span className={`pill ${job.status === 'completed' ? 'approved' : job.status === 'cancelled' ? 'rejected' : 'pending'}`}>
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
                      <div className="risk-score risk-low" style={{ width: 36, height: 36, fontSize: 'var(--fs-sm)' }}>
                        {review.rating}★
                      </div>
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {review.job_id ? (
                        <a className="link-accent" href={`/jobs/${review.job_id}`}>
                          {jobTitleById[review.job_id] || 'Untitled job'}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="text-muted-sm">
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

      <div className="table-card">
        <div className="table-card-header">
          <h3>Coverage by Area</h3>
          <span className="badge">Requests per provider</span>
        </div>
        {coverage.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Providers</th>
                <th>Requests</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => (
                <tr key={row.area}>
                  <td><strong>{row.area}</strong></td>
                  <td>{row.supply}</td>
                  <td>{row.demand}</td>
                  <td>
                    <span className={`pill ${row.supply === 0 && row.demand > 0 ? 'rejected' : row.ratio > 3 ? 'pending' : 'approved'}`}>
                      {row.supply === 0 && row.demand > 0 ? 'No coverage' : `${row.ratio.toFixed(1)}x`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">No area data yet</div>
        )}
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
