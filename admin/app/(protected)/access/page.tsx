import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { InviteAdminForm } from './InviteAdminForm';
import { setAdminDisabled, setAdminRole } from './actions';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ tab?: string }> };

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const stampTime = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));

const ACTION_LABELS: Record<string, string> = {
  INVITED_ADMIN: 'invited an admin',
  CHANGED_ADMIN_ROLE: "changed an admin's role",
  DISABLED_ADMIN: 'disabled an admin',
  ENABLED_ADMIN: 're-enabled an admin',
  APPROVED_VERIFICATION: 'approved a verification',
  REJECTED_VERIFICATION: 'rejected a verification',
  RESOLVED_DISPUTE: 'resolved a dispute',
};

export default async function AccessPage({ searchParams }: Props) {
  const { tab: requestedTab } = await searchParams;
  const tab = requestedTab === 'activity' ? 'activity' : 'team';

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: admins, error: adminsError }, me] = await Promise.all([
    supabase.from('admins').select('id, email, role, disabled_at, created_at').order('created_at', { ascending: true }),
    supabase.from('admins').select('role, disabled_at').eq('id', user?.id ?? '').maybeSingle(),
  ]);

  const isOwner = me.data?.role === 'owner' && !me.data?.disabled_at;

  const { data: activity, error: activityError } =
    tab === 'activity' && isOwner
      ? await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100)
      : { data: [], error: null };

  const errors = [adminsError?.message, activityError?.message];

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
        </>
      ) : (
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
                <tr><td colSpan={4} className="empty">No admin activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
