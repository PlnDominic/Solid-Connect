import { createServerSupabase } from '../../../lib/supabase';
import { SettingsClient } from './SettingsClient';
import { updateCommission } from './actions';

export const dynamic = 'force-dynamic';

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Same isOwner computation as access/page.tsx's own admin-vs-owner check,
  // reused here for the same reason: the Commission action already
  // no-ops for a non-owner (see actions.ts), so the form itself has to
  // agree with that or a support admin can "Save" a rate change that
  // silently does nothing.
  const [{ data: me }, { data: config }] = await Promise.all([
    supabase.from('admins').select('email, role, disabled_at, created_at').eq('id', user?.id ?? '').maybeSingle(),
    supabase.from('platform_config').select('commission_percent').eq('id', true).maybeSingle(),
  ]);

  const isOwner = me?.role === 'owner' && !me?.disabled_at;

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Configuration</div>
        <h1>Settings</h1>
        <p className="page-header-sub">Platform-wide settings and your own admin account.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
        {isOwner && (
          <div className="chart-panel">
            <div className="chart-panel-header">
              <h3>Commission</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              The percentage Solid Connect keeps from each completed job&apos;s payment. Owner-only.
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
        )}

        <SettingsClient />

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Your account</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Signed in as</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{me?.email ?? user?.email ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Role</div>
              <span className={`pill ${isOwner ? 'approved' : 'pending'}`}>{isOwner ? 'Owner' : 'Support'}</span>
            </div>
            {me?.created_at && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Admin since</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{stamp(me.created_at)}</div>
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
            Managed through Supabase Auth. To change your password, email{' '}
            <a href="mailto:support@solidconnect.co?subject=Admin%20password%20reset" style={{ color: 'var(--accent-text)' }}>
              support@solidconnect.co
            </a>{' '}
            - there&apos;s no self-service reset yet.
          </p>
        </div>
      </div>
    </>
  );
}
