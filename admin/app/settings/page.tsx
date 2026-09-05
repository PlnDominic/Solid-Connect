'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [theme, setTheme] = useState<string>(
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') ?? 'dark'
      : 'dark'
  );

  const switchTheme = (t: string) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    setTheme(t);
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-eyebrow">Configuration</div>
        <h1>Settings</h1>
        <p className="page-header-sub">Manage platform settings and admin preferences.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Appearance */}
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Appearance</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Switch between dark and light mode for the admin dashboard.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => switchTheme('dark')}
              style={{
                flex: 1, padding: '14px 16px', borderRadius: 10,
                border: theme === 'dark' ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: theme === 'dark' ? 'var(--accent-bg)' : 'var(--bg-input)',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              🌙 Dark Mode
            </button>
            <button
              onClick={() => switchTheme('light')}
              style={{
                flex: 1, padding: '14px 16px', borderRadius: 10,
                border: theme === 'light' ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: theme === 'light' ? 'var(--accent-bg)' : 'var(--bg-input)',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              ☀️ Light Mode
            </button>
          </div>
        </div>

        {/* Platform Info */}
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Platform Info</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Platform Name</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Solid Connect</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Version</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>1.0.0</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Support</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                <a href="mailto:support@solidconnect.co" style={{ color: 'var(--accent)' }}>support@solidconnect.co</a>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Environment</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Production</div>
            </div>
          </div>
        </div>

        {/* Admin Account */}
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Admin Account</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Your admin session is managed through Supabase Auth. Sign out and sign in with a different account to switch.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Role</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Administrator</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Access Level</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Full Access</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Quick Actions</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href="/verifications"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                transition: 'border-color .2s',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Review Pending Verifications
            </a>
            <a
              href="/analytics"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                transition: 'border-color .2s',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Analytics Dashboard
            </a>
            <a
              href="mailto:support@solidconnect.co"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)',
                fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                transition: 'border-color .2s',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
