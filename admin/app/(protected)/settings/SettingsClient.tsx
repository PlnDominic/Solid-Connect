'use client';

import { useAdminTheme } from '../../hooks/useAdminTheme';

// Same icons as the sidebar's ThemeToggle (app/components/ThemeToggle.tsx) -
// one icon language for the same setting, not emoji here and SVG there.
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

/**
 * The one setting that's genuinely a preference, not a fabricated
 * "platform info" or "quick actions" panel - see the sidebar's own
 * ThemeToggle for the quick-access version of this same control; this is
 * the explicit, named version people expect to find under Settings.
 */
export function SettingsClient() {
  const { theme, setTheme: switchTheme } = useAdminTheme();

  return (
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
          className="filter-btn"
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: '12px 16px',
            border: theme === 'dark' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            background: theme === 'dark' ? 'var(--accent-bg)' : 'var(--bg-input)',
            color: theme === 'dark' ? 'var(--accent-text)' : 'var(--text-secondary)',
          }}
        >
          <MoonIcon /> Dark
        </button>
        <button
          onClick={() => switchTheme('light')}
          className="filter-btn"
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: '12px 16px',
            border: theme === 'light' ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            background: theme === 'light' ? 'var(--accent-bg)' : 'var(--bg-input)',
            color: theme === 'light' ? 'var(--accent-text)' : 'var(--text-secondary)',
          }}
        >
          <SunIcon /> Light
        </button>
      </div>
    </div>
  );
}
