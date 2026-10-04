import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { SettingsClient } from './SettingsClient';
import { purgeStorageQueue, updateCommission, updateDepositPolicy, updatePlatformSettings } from './actions';

const DEFAULT_SUPPORT_EMAIL = 'support@solidconnect.co';
const PAYOUT_METHODS = ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money', 'Bank transfer'];

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
  const [{ data: me }, { data: config }, { count: pendingPurgeCount }, { count: teamCount }] = await Promise.all([
    supabase.from('admins').select('email, role, disabled_at, created_at').eq('id', user?.id ?? '').maybeSingle(),
    supabase.from('platform_config').select('commission_percent, deposit_percent, cancel_compensation_percent, support_email, default_payout_method').eq('id', true).maybeSingle(),
    supabase.from('storage_purge_queue').select('id', { count: 'exact', head: true }).is('purged_at', null),
    supabase.from('admins').select('id', { count: 'exact', head: true }).is('disabled_at', null),
  ]);

  const isOwner = me?.role === 'owner' && !me?.disabled_at;
  const supportEmail = config?.support_email || DEFAULT_SUPPORT_EMAIL;

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
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
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
                className="input" style={{ width: 90 }}
              />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>%</span>
              <button className="btn" style={{ marginLeft: 8 }}>Save</button>
            </form>
          </div>
        )}

        {isOwner && (
          <div className="chart-panel">
            <div className="chart-panel-header">
              <h3>Deposits</h3>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Customers pay Solid Connect a deposit to secure a booking and the balance after the work, never the
              provider directly. Set the deposit to 0% to turn deposits off. Changes apply to new bookings. Owner-only.
            </p>
            <form action={updateDepositPolicy} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-sm)' }}>
                <span style={{ width: 260, color: 'var(--text-secondary)' }}>Deposit, % of the job price</span>
                <input
                  name="deposit_percent"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  defaultValue={config?.deposit_percent ?? 30}
                  className="input" style={{ width: 90 }}
                />
                <span style={{ color: 'var(--text-muted)' }}>%</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--fs-sm)' }}>
                <span style={{ width: 260, color: 'var(--text-secondary)' }}>Provider&apos;s share when a customer cancels after paying</span>
                <input
                  name="cancel_compensation_percent"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  defaultValue={config?.cancel_compensation_percent ?? 50}
                  className="input" style={{ width: 90 }}
                />
                <span style={{ color: 'var(--text-muted)' }}>%</span>
              </label>
              <div>
                <button className="btn">Save</button>
              </div>
            </form>
          </div>
        )}

        {isOwner && (
          <div className="chart-panel">
            <div className="chart-panel-header">
              <h3>Payout &amp; support</h3>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
              The support address shown to admins and the payout method pre-selected on every &quot;Mark paid&quot;
              action. Owner-only.
            </p>
            <form action={updatePlatformSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Support email
                </label>
                <input
                  name="support_email"
                  type="email"
                  required
                  defaultValue={supportEmail}
                  className="search-input"
                  style={{ maxWidth: 320 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Default payout method
                </label>
                <select
                  name="default_payout_method"
                  defaultValue={config?.default_payout_method ?? ''}
                  className="input" style={{ width: '100%', maxWidth: 320 }}
                >
                  <option value="">None - leave blank on /payouts</option>
                  {PAYOUT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              <button className="btn" style={{ alignSelf: 'start' }}>Save</button>
            </form>
          </div>
        )}

        <SettingsClient />

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Team</h3>
          </div>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
            {teamCount ?? 0} active admin{teamCount === 1 ? '' : 's'}. Invite people, change roles and permissions,
            and browse the audit log from the Team page.
          </p>
          <Link href="/access" className="filter-btn" style={{ display: 'inline-flex' }}>Manage team →</Link>
        </div>

        {isOwner && !!pendingPurgeCount && (
          <div className="chart-panel">
            <div className="chart-panel-header">
              <h3>Storage cleanup</h3>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
              {pendingPurgeCount} file{pendingPurgeCount === 1 ? '' : 's'} queued by the nightly data-retention job
              (rejected verification documents past their retention window) still need deleting - SQL can clear the
              database reference, but not the file itself; only the Storage API can, which is what this does.
            </p>
            <form action={purgeStorageQueue}>
              <button className="btn">Purge {pendingPurgeCount} file{pendingPurgeCount === 1 ? '' : 's'} now</button>
            </form>
          </div>
        )}

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h3>Your account</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Signed in as</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{me?.email ?? user?.email ?? '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Role</div>
              <span className={`pill ${isOwner ? 'approved' : 'pending'}`}>{isOwner ? 'Owner' : 'Support'}</span>
            </div>
            {me?.created_at && (
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Admin since</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{stamp(me.created_at)}</div>
              </div>
            )}
          </div>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 16 }}>
            Managed through Supabase Auth. To change your password, email{' '}
            <a href={`mailto:${supportEmail}?subject=Admin%20password%20reset`} className="text-accent">
              {supportEmail}
            </a>{' '}
            - there&apos;s no self-service reset yet.
          </p>
        </div>
      </div>
    </>
  );
}
