import { createServerSupabase } from '../../lib/supabase';

/* ── helpers ──────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('en-US');

/* ── sparkline SVG ────────────────────────────────────────── */
function Sparkline({ data, color = 'var(--accent)' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
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
function Donut({ segments, total }: { segments: { color: string; pct: number; label: string; count: number }[]; total: number }) {
  let acc = 0;
  const grad = segments.map(s => { const start = acc; acc += s.pct; return `${s.color} ${start}% ${acc}%`; }).join(', ');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <div className="donut-wrap">
        <div className="donut" style={{ background: `conic-gradient(${grad})` }} />
        <div className="donut-center">
          <div className="num">{fmt(total)}</div>
          <div className="lbl">At Risk</div>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map(s => (
          <span key={s.label}>
            <span className="dot" style={{ background: s.color }} />
            {s.label}
            <span className="count">{fmt(s.count)} ({s.pct}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── retention line chart ─────────────────────────────────── */
const retentionData = [82, 78, 75, 71, 68, 64, 58, 55, 50, 47, 43, 42];
const retMax = 100;
const retPoints = retentionData.map((v, i) => `${(i / (retentionData.length - 1)) * 100},${100 - (v / retMax) * 90}`).join(' ');
const retLabels = ['May 10', 'May 17', 'May 24', 'May 31', 'Jun 7'];

/* ── page ─────────────────────────────────────────────────── */
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

  const highRisk = Math.round(pending * 0.36);
  const medRisk = Math.round(pending * 0.40);
  const lowRisk = pending - highRisk - medRisk;

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-eyebrow">Platform Health</div>
        <h1>Predictive Provider Insights</h1>
        <p className="page-header-sub">AI-powered insights to identify at-risk providers and take proactive action.</p>
        <div className="page-header-actions">
          <span className="date-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            Last 30 Days ▾
          </span>
          <button className="filter-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
            Filters
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">At Risk Providers</div>
          <div className="stat-card-value">{fmt(pending)}</div>
          <div className="stat-card-trend up">↑ 18.6%</div>
          <div className="stat-card-sub">{providers > 0 ? ((pending / providers) * 100).toFixed(1) : 0}% of total providers</div>
          <Sparkline data={[32, 38, 35, 42, 40, 45, 48, 44, 50, 52, 48, 55]} />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">High Risk</div>
          <div className="stat-card-value">{fmt(highRisk)}</div>
          <div className="stat-card-trend up">↑ 24.3%</div>
          <div className="stat-card-sub">{providers > 0 ? ((highRisk / providers) * 100).toFixed(1) : 0}% of total providers</div>
          <Sparkline data={[20, 24, 22, 28, 30, 26, 32, 35, 33, 38, 36, 40]} />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Verification Score (Avg)</div>
          <div className="stat-card-value">72</div>
          <div className="stat-card-trend up">↑ 6 pts</div>
          <div className="stat-card-sub">vs prior 30 days</div>
          <Sparkline data={[60, 62, 65, 63, 68, 70, 67, 72, 74, 71, 73, 72]} />
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Predicted Revenue Impact</div>
          <div className="stat-card-value">${fmt(142680)}</div>
          <div className="stat-card-trend up">↑ 12.4%</div>
          <div className="stat-card-sub">in projected revenue at risk</div>
          <Sparkline data={[80, 95, 88, 110, 105, 120, 125, 130, 128, 135, 140, 143]} />
        </div>
      </div>

      {/* ── Retention Trend + Risk Distribution ── */}
      <div className="chart-row">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Retention Trend</h3>
            <span className="badge">Retention Rate ▾</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="line-chart">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity=".2" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`0,100 ${retPoints} 100,100`} fill="url(#retGrad)" />
                  <polyline points={retPoints} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                  {retentionData.map((v, i) => (
                    <circle key={i} cx={(i / (retentionData.length - 1)) * 100} cy={100 - (v / retMax) * 90} r="1.5" fill="var(--accent)" />
                  ))}
                </svg>
              </div>
              <div className="line-chart-labels">
                {retLabels.map(l => <span key={l}>{l}</span>)}
              </div>
            </div>
            <div className="retention-info">
              <div className="retention-stat">
                <div className="value">42.1%</div>
                <div className="label">Current Retention Rate</div>
              </div>
              <div className="retention-stat">
                <div className="value" style={{ color: 'var(--red)' }}>↓ 11.3%</div>
                <div className="label">vs prior 30 days</div>
              </div>
            </div>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Risk Score Distribution</h3>
          </div>
          <Donut
            total={pending}
            segments={[
              { color: '#ef4444', pct: 36.1, label: 'High Risk', count: highRisk },
              { color: '#f97316', pct: 40.3, label: 'Medium Risk', count: medRisk },
              { color: '#22c55e', pct: 23.6, label: 'Low Risk', count: lowRisk },
            ]}
          />
        </div>
      </div>

      {/* ── At Risk Table + Triggers ── */}
      <div className="bottom-row">
        <div className="table-card">
          <div className="table-card-header">
            <h3>At Risk Providers</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Risk Score</th>
                <th>Risk Level</th>
                <th>Top Risk Factor</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>JD</div>
                    <div><strong>John Doe</strong><br /><span className="mono">j.doe@email.com</span></div>
                  </div>
                </td>
                <td><div className="risk-score risk-high">92</div></td>
                <td><span className="status-badge status-high">High</span></td>
                <td>Payment failed</td>
                <td>2 days ago</td>
              </tr>
              <tr>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>AA</div>
                    <div><strong>Ama Asante</strong><br /><span className="mono">a.asante@email.com</span></div>
                  </div>
                </td>
                <td><div className="risk-score risk-high">89</div></td>
                <td><span className="status-badge status-high">High</span></td>
                <td>Decreased usage</td>
                <td>3 days ago</td>
              </tr>
              <tr>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>KM</div>
                    <div><strong>Kofi Mensah</strong><br /><span className="mono">k.mensah@email.com</span></div>
                  </div>
                </td>
                <td><div className="risk-score risk-high">85</div></td>
                <td><span className="status-badge status-high">High</span></td>
                <td>Support ticket</td>
                <td>5 days ago</td>
              </tr>
              <tr>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>EO</div>
                    <div><strong>Efua Osei</strong><br /><span className="mono">e.osei@email.com</span></div>
                  </div>
                </td>
                <td><div className="risk-score risk-high">78</div></td>
                <td><span className="status-badge status-high">High</span></td>
                <td>Feature unused</td>
                <td>1 week ago</td>
              </tr>
              <tr>
                <td>
                  <div className="profile-cell">
                    <div className="profile-avatar" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>RA</div>
                    <div><strong>Ralph Ansah</strong><br /><span className="mono">r.ansah@email.com</span></div>
                  </div>
                </td>
                <td><div className="risk-score risk-medium">65</div></td>
                <td><span className="status-badge status-medium">Medium</span></td>
                <td>Login frequency</td>
                <td>1 week ago</td>
              </tr>
            </tbody>
          </table>
          <a className="table-link" href="/verifications">View All At Risk Providers →</a>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Automated Intervention Triggers</h3>
          </div>
          <div className="trigger-list">
            <div className="trigger-card">
              <div className="trigger-icon" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
              </div>
              <div className="trigger-info">
                <div className="title">Payment Failure <span className="active-badge">Active</span></div>
                <div className="desc">Trigger win-back flow when payment fails 2+ times.</div>
              </div>
              <div className="trigger-count">482</div>
            </div>
            <div className="trigger-card">
              <div className="trigger-icon" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
              </div>
              <div className="trigger-info">
                <div className="title">Decreased Usage <span className="active-badge">Active</span></div>
                <div className="desc">Trigger when usage drops by 40%+ in 7 days.</div>
              </div>
              <div className="trigger-count">731</div>
            </div>
            <div className="trigger-card">
              <div className="trigger-icon" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <div className="trigger-info">
                <div className="title">Support Interaction <span className="active-badge">Active</span></div>
                <div className="desc">Trigger when negative sentiment is detected.</div>
              </div>
              <div className="trigger-count">215</div>
            </div>
          </div>
          <a className="table-link" href="#" style={{ display: 'inline-flex', margin: '12px 0 0' }}>Manage Triggers →</a>
        </div>
      </div>

      {/* ── AI Insight ── */}
      <div className="insight-banner">
        <div className="insight-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
        </div>
        <div className="insight-text">
          <strong>AI Insight</strong>
          <p>Providers with decreased usage and payment issues are <strong style={{ color: 'var(--accent)' }}>2.3x more likely</strong> to churn. Consider prioritizing outreach to these segments.</p>
        </div>
        <button className="insight-cta">View Recommended Actions →</button>
      </div>
    </>
  );
}
