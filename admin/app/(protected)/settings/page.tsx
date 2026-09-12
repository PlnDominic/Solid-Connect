import { createServerSupabase } from '../../../lib/supabase';
import { SettingsClient } from './SettingsClient';
import { updateCommission } from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const { data: config } = await supabase.from('platform_config').select('commission_percent').eq('id', true).maybeSingle();

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-eyebrow">Configuration</div>
        <h1>Settings</h1>
        <p className="page-header-sub">Manage platform settings and admin preferences.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Commission */}
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Commission</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            The percentage Solid Connect keeps from each completed job's payment. Owner-only.
          </p>
          <form action={updateCommission} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              name="commission_percent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={config?.commission_percent ?? 15}
              style={{ width: 90, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}
            />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>%</span>
            <button className="btn" style={{ padding: '10px 20px', marginLeft: 8 }}>Save</button>
          </form>
        </div>

        <SettingsClient />
      </div>
    </>
  );
}
