import { createServerSupabase } from '../../lib/supabase';

/* ── tiny helpers ────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (n: number) => `${n}%`;

/* ── Donut chart (pure CSS conic-gradient) ───────────────────── */
function Donut({ segments, size = 64 }: { segments: { color: string; pct: number }[]; size?: number }) {
  const gradient = segments.reduce((acc, s, i) => {
    const start = segments.slice(0, i).reduce((a, b) => a + b.pct, 0);
    return `${acc}${s.color} ${start}% ${start + s.pct}%${i < segments.length - 1 ? ',' : ''}`;
  }, '');
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <div className="donut" style={{ width: size, height: size, background: `conic-gradient(${gradient})` }} />
      <div className="donut-center" style={{ width: size * 0.56, height: size * 0.56 }} />
    </div>
  );
}

/* ── Circular progress ───────────────────────────────────────── */
function CircularProgress({ value, color }: { value: number; color: string }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <div className="circular-progress">
      <svg viewBox="0 0 48 48">
        <circle className="track" cx="24" cy="24" r={r} />
        <circle className="fill" cx="24" cy="24" r={r} stroke={color}
          strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} />
      </svg>
      <span className="pct" style={{ color }}>+{value}%</span>
    </div>
  );
}

/* ── Bar chart data ──────────────────────────────────────────── */
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const barData = [45, 52, 38, 65, 78, 56, 42, 70, 85, 63, 55, 90];
const barMax = Math.max(...barData);

/* ── Line chart data ─────────────────────────────────────────── */
const lineData = [20, 28, 25, 35, 32, 45, 38, 52, 48, 60, 55, 68];
const lineMax = Math.max(...lineData);
const linePoints = lineData.map((v, i) => {
  const x = (i / (lineData.length - 1)) * 100;
  const y = 100 - (v / lineMax) * 80;
  return `${x},${y}`;
}).join(' ');

/* ── Page ────────────────────────────────────────────────────── */
export default async function AnalyticsPage() {
  const supabase = await createServerSupabase();

  const [
    { count: totalProviders },
    { count: pendingVerifications },
    { count: approvedVerifications },
    { count: totalJobs },
    { count: totalCustomers },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'provider'),
    supabase.from('provider_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('provider_verifications').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'customer'),
  ]);

  const providers = totalProviders ?? 0;
  const pending = pendingVerifications ?? 0;
  const approved = approvedVerifications ?? 0;
  const jobs = totalJobs ?? 0;
  const customers = totalCustomers ?? 0;

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <h1>Analytics</h1>
        <div className="page-header-meta">
          <span className="date-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            01.08.2026 – 31.08.2026
          </span>
          <span className="date-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          </span>
        </div>
      </div>

      {/* ── Stat Cards Row 1 ── */}
      <div className="stats-grid">
        {/* Providers */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Providers</span>
            <div className="stat-card-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
            </div>
          </div>
          <div className="stat-card-value">{fmt(providers)}</div>
          <div className="stat-card-trend up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17l5-5 5 5M7 7l5 5 5-5" /></svg>
            12.4% since last month
          </div>
        </div>

        {/* Verified */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Verified</span>
            <div className="stat-card-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
          </div>
          <div className="stat-card-value">{fmt(approved)}</div>
          <div className="stat-card-trend up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17l5-5 5 5M7 7l5 5 5-5" /></svg>
            8.1% since last month
          </div>
        </div>

        {/* Jobs */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Jobs</span>
          </div>
          <div className="stat-card-value">{fmt(jobs)}</div>
          <div className="stat-card-body">
            <div className="donut-legend">
              <span><span className="dot" style={{ background: '#2563eb' }} /> Completed</span>
              <span><span className="dot" style={{ background: '#f59e0b' }} /> Active</span>
              <span><span className="dot" style={{ background: '#e5e7eb' }} /> Cancelled</span>
            </div>
            <Donut segments={[
              { color: '#2563eb', pct: 62 },
              { color: '#f59e0b', pct: 26 },
              { color: '#e5e7eb', pct: 12 },
            ]} />
          </div>
        </div>

        {/* Customers */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Customers</span>
          </div>
          <div className="stat-card-value">{fmt(customers)}</div>
          <div className="stat-card-body">
            <div className="donut-legend">
              <span><span className="dot" style={{ background: '#2563eb' }} /> Active</span>
              <span><span className="dot" style={{ background: '#e5e7eb' }} /> Inactive</span>
            </div>
            <Donut segments={[
              { color: '#2563eb', pct: 75 },
              { color: '#e5e7eb', pct: 25 },
            ]} />
          </div>
        </div>
      </div>

      {/* ── Stat Cards Row 2 ── */}
      <div className="stats-wide">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Pending Reviews</span>
            <div className="stat-card-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            </div>
          </div>
          <div className="stat-card-value">{fmt(pending)}</div>
          <div className="stat-card-trend down">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 7l-5 5-5-5" /></svg>
            3.2% since last month
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Verifications</span>
            <div className="stat-card-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
            </div>
          </div>
          <div className="stat-card-value">{fmt(approved + pending)}</div>
          <div className="stat-card-trend up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17l5-5 5 5M7 7l5 5 5-5" /></svg>
            5.6% since last month
          </div>
        </div>
      </div>

      {/* ── Sales Dynamics (Bar Chart) ── */}
      <div className="chart-panel">
        <div className="chart-panel-header">
          <h3>Jobs Overview</h3>
          <span className="year-badge">2026 ▾</span>
        </div>
        <div className="bar-chart">
          {months.map((m, i) => (
            <div className="bar-chart-col" key={m}>
              <div className="bar" style={{ height: `${(barData[i] / barMax) * 100}%` }} />
              <span className="bar-chart-label">{m}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Financial Cards ── */}
      <div className="fin-grid">
        <div className="fin-card">
          <div className="fin-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
          </div>
          <div className="fin-card-info">
            <div className="label">Active Providers</div>
            <div className="value">{fmt(providers)}</div>
            <div className="sub">Current Period</div>
          </div>
          <CircularProgress value={72} color="#7c3aed" />
        </div>
        <div className="fin-card">
          <div className="fin-card-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
          </div>
          <div className="fin-card-info">
            <div className="label">Completed Jobs</div>
            <div className="value">{fmt(jobs)}</div>
            <div className="sub">Current Period</div>
          </div>
          <CircularProgress value={58} color="#16a34a" />
        </div>
      </div>

      {/* ── Overall User Activity (Line Chart) ── */}
      <div className="chart-panel">
        <div className="chart-panel-header">
          <h3>Overall User Activity</h3>
          <span className="year-badge">2026 ▾</span>
        </div>
        <div className="line-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity=".2" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${linePoints} 100,100`} fill="url(#lineGrad)" />
            <polyline points={linePoints} fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* ── Recent Jobs Table ── */}
      <div className="table-card">
        <div className="table-card-header">
          <h3>Recent Jobs</h3>
          <button aria-label="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Category</th>
              <th>Area</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="profile-cell">
                  <div className="profile-avatar" style={{ background: '#dbeafe', color: '#2563eb' }}>JD</div>
                  <div><strong>John Doe</strong><br /><span className="mono">Plumbing</span></div>
                </div>
              </td>
              <td>Plumbing</td>
              <td>Accra</td>
              <td><span className="status-pill delivered">Completed</span></td>
            </tr>
            <tr>
              <td>
                <div className="profile-cell">
                  <div className="profile-avatar" style={{ background: '#fef3c7', color: '#d97706' }}>AA</div>
                  <div><strong>Ama Asante</strong><br /><span className="mono">Electrical</span></div>
                </div>
              </td>
              <td>Electrical</td>
              <td>Kumasi</td>
              <td><span className="status-pill processed">Active</span></td>
            </tr>
            <tr>
              <td>
                <div className="profile-cell">
                  <div className="profile-avatar" style={{ background: '#fce7f3', color: '#db2777' }}>KM</div>
                  <div><strong>Kofi Mensah</strong><br /><span className="mono">Carpentry</span></div>
                </div>
              </td>
              <td>Carpentry</td>
              <td>Tamale</td>
              <td><span className="status-pill cancelled">Cancelled</span></td>
            </tr>
            <tr>
              <td>
                <div className="profile-cell">
                  <div className="profile-avatar" style={{ background: '#dcfce7', color: '#16a34a' }}>EO</div>
                  <div><strong>Efua Osei</strong><br /><span className="mono">Painting</span></div>
                </div>
              </td>
              <td>Painting</td>
              <td>Takoradi</td>
              <td><span className="status-pill delivered">Completed</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
