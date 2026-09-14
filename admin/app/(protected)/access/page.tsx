import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ADMIN_PERMISSIONS, ADMIN_PERMISSION_LABELS, type AdminPermission } from '../../../lib/admin';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { InviteAdminForm } from './InviteAdminForm';
import { setAdminDisabled, setAdminPermissions, setAdminRole } from './actions';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ tab?: string; page?: string; action?: string }> };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const stampTime = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));

// Every action string logAdminAction() is actually called with, across
// every actions.ts file in the panel - kept complete on purpose, since an
// unlabeled raw code (COMPLETED_ACCOUNT_DELETION verbatim) defeats the
// point of a browsable log.
const ACTION_LABELS: Record<string, string> = {
  INVITED_ADMIN: 'invited an admin',
  CHANGED_ADMIN_ROLE: "changed an admin's role",
  CHANGED_ADMIN_PERMISSIONS: "changed an admin's permissions",
  DISABLED_ADMIN: 'disabled an admin',
  ENABLED_ADMIN: 're-enabled an admin',
  APPROVED_VERIFICATION: 'approved a verification',
  REJECTED_VERIFICATION: 'rejected a verification',
  BULK_APPROVED_VERIFICATIONS: 'bulk-approved verifications',
  BULK_REJECTED_VERIFICATIONS: 'bulk-rejected verifications',
  RESOLVED_DISPUTE: 'resolved a dispute',
  OVERRODE_PAYMENT: 'overrode a payment',
  MARKED_PAYOUT_PAID: 'marked a payout paid',
  CREATED_CATEGORY: 'created a category',
  UPDATED_CATEGORY: 'updated a category',
  ARCHIVED_CATEGORY: 'archived a category',
  RESTORED_CATEGORY: 'restored a category',
  HID_REVIEW: 'hid a review',
  UNHID_REVIEW: 'restored a review',
  SUSPENDED_ACCOUNT: 'suspended an account',
  UNSUSPENDED_ACCOUNT: 'unsuspended an account',
  SENT_BROADCAST: 'sent a broadcast',
  UPDATED_COMMISSION: 'updated the commission rate',
  COMPLETED_ACCOUNT_DELETION: 'completed an account deletion',
  DISMISSED_ACCOUNT_DELETION_REQUEST: 'dismissed a deletion request',
};

const ACTIVITY_PAGE_SIZE = PAGE_SIZE;

export default async function AccessPage({ searchParams }: Props) {
  const { tab: requestedTab, page: pageRaw, action: actionFilter } = await searchParams;
  const tab = requestedTab === 'activity' ? 'activity' : 'team';

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: admins, error: adminsError }, me] = await Promise.all([
    supabase.from('admins').select('id, email, role, disabled_at, permissions, created_at').order('created_at', { ascending: true }),
    supabase.from('admins').select('role, disabled_at').eq('id', user?.id ?? '').maybeSingle(),
  ]);

  const isOwner = me.data?.role === 'owner' && !me.data?.disabled_at;

  const activityFilterValid = actionFilter && actionFilter in ACTION_LABELS;
  const requestedActivityPage = parsePage(pageRaw);

  const buildActivityQuery = (opts: { count?: boolean } = {}) => {
    let q = supabase.from('admin_audit_log').select('*', opts.count ? { count: 'exact', head: true } : undefined);
    if (activityFilterValid) q = q.eq('action', actionFilter!);
    return q;
  };

  const { count: activityTotal, error: activityCountError } =
    tab === 'activity' && isOwner ? await buildActivityQuery({ count: true }) : { count: 0, error: null };

  const activityPage = clampPage(requestedActivityPage, activityTotal ?? 0, ACTIVITY_PAGE_SIZE);
  const activityFrom = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
  const activityTo = activityFrom + ACTIVITY_PAGE_SIZE - 1;

  const { data: activity, error: activityError } =
    tab === 'activity' && isOwner
      ? await buildActivityQuery().order('created_at', { ascending: false }).range(activityFrom, activityTo)
      : { data: [], error: null };

  const errors = [adminsError?.message, activityError?.message, activityCountError?.message];

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Administration</div>
        <h1>Team</h1>
        <p className="page-header-sub">Manage who has admin access and what they can do.</p>
      </div>

      <ErrorBanner errors={errors} />

      <nav className="tabs" style={{ marginTop: 0 }}>
        <Link href="/access?tab=team" className={tab === 'team' ? 'selected' : ''}>Team</Link>
        {isOwner && <Link href="/access?tab=activity" className={tab === 'activity' ? 'selected' : ''}>Activity</Link>}
      </nav>

      {tab === 'team' ? (
        <>
          {isOwner && <InviteAdminForm />}

          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  {isOwner && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(admins ?? []).length > 0 ? (admins ?? []).map((a) => {
                  const isSelf = a.id === user?.id;
                  return (
                    <tr key={a.id}>
                      <td><strong>{a.email}</strong>{isSelf && <span className="mono" style={{ color: 'var(--text-muted)', marginLeft: 6 }}>(you)</span>}</td>
                      <td>
                        <span className={`pill ${a.role === 'owner' ? 'approved' : 'pending'}`}>{a.role === 'owner' ? 'Owner' : 'Support'}</span>
                      </td>
                      <td>
                        <span className={`pill ${a.disabled_at ? 'rejected' : 'approved'}`}>{a.disabled_at ? 'Disabled' : 'Active'}</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stamp(a.created_at)}</td>
                      {isOwner && (
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <form action={setAdminRole.bind(null, a.id)} style={{ display: 'flex', gap: 6 }}>
                              <select
                                name="role"
                                defaultValue={a.role}
                                disabled={isSelf}
                                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
                              >
                                <option value="support">Support</option>
                                <option value="owner">Owner</option>
                              </select>
                              {!isSelf && <button className="filter-btn" style={{ padding: '6px 12px' }}>Save</button>}
                            </form>
                            {!isSelf && (
                              <form action={setAdminDisabled.bind(null, a.id, !a.disabled_at)}>
                                <button className="filter-btn" style={{ padding: '6px 12px' }}>{a.disabled_at ? 'Enable' : 'Disable'}</button>
                              </form>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={isOwner ? 5 : 4} className="empty">No admins found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {isOwner && (admins ?? []).some((a) => a.role === 'support' && !a.disabled_at) && (
            <>
              <div className="page-header" style={{ marginTop: 28, marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Permissions</h3>
                <p className="page-header-sub" style={{ marginTop: 4 }}>
                  What each support admin can act on. Owners always have every scope, plus team management, the
                  audit log, and the commission rate - those three stay owner-only and aren&apos;t granted here.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(admins ?? [])
                  .filter((a) => a.role === 'support' && !a.disabled_at)
                  .map((a) => {
                    const granted: string[] = a.permissions ?? [];
                    return (
                      <div key={a.id} className="table-card" style={{ padding: 16 }}>
                        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13.5 }}>{a.email}</div>
                        <form action={setAdminPermissions.bind(null, a.id)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                            {ADMIN_PERMISSIONS.map((scope: AdminPermission) => (
                              <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                                <input type="checkbox" name={scope} defaultChecked={granted.includes(scope)} />
                                {ADMIN_PERMISSION_LABELS[scope]}
                              </label>
                            ))}
                          </div>
                          <button className="filter-btn" style={{ padding: '6px 14px', alignSelf: 'start' }}>Save permissions</button>
                        </form>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <form style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="hidden" name="tab" value="activity" />
            <select
              name="action"
              defaultValue={activityFilterValid ? actionFilter : ''}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS)
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([action, label]) => (
                  <option key={action} value={action}>{label}</option>
                ))}
            </select>
            <button className="filter-btn" style={{ padding: '8px 16px' }}>Filter</button>
            {activityFilterValid && <Link href="/access?tab=activity" className="filter-btn" style={{ padding: '8px 16px' }}>Clear</Link>}
          </form>

          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Detail</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(activity ?? []).length > 0 ? (activity ?? []).map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.admin_email}</td>
                    <td>{ACTION_LABELS[e.action] ?? e.action}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {e.note ?? (e.target_id ? <span className="mono">{String(e.target_id).slice(0, 8)}</span> : '—')}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stampTime(e.created_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="empty">No admin activity{activityFilterValid ? ' of this kind' : ''} yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={activityPage}
            pageSize={ACTIVITY_PAGE_SIZE}
            total={activityTotal ?? 0}
            basePath="/access"
            params={{ tab: 'activity', action: activityFilterValid ? actionFilter : undefined }}
          />
        </>
      )}
    </>
  );
}
