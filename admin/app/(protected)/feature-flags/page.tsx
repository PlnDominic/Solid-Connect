import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { CreateFlagForm } from './CreateFlagForm';
import { deleteFlag, updateFlag } from './actions';

export const dynamic = 'force-dynamic';

const stamp = (date: string | null) =>
  date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date)) : '—';

export default async function FeatureFlagsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('admins').select('role, disabled_at').eq('id', user?.id ?? '').maybeSingle();
  const isOwner = me?.role === 'owner' && !me?.disabled_at;

  const { data: flags, error } = await supabase.from('feature_flags').select('*').order('created_at', { ascending: false });

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Configuration</div>
        <h1>Feature flags</h1>
        <p className="page-header-sub">
          Stage a feature to a percentage of users before turning it on for everyone - see useFeatureFlag on mobile
          for how a user's in/out decision is made (deterministic per flag, not a fresh roll every app open).
        </p>
      </div>

      <ErrorBanner errors={[error?.message]} />

      {!isOwner ? (
        <div className="empty">Only owners can manage feature flags.</div>
      ) : (
        <>
          <CreateFlagForm />

          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Description</th>
                  <th>Enabled</th>
                  <th>Rollout</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(flags ?? []).length > 0 ? (flags ?? []).map((f) => {
                  const formId = `flag-${f.key}`;
                  return (
                    <tr key={f.key}>
                      <td><span className="mono" style={{ fontWeight: 700 }}>{f.key}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12.5, maxWidth: 260 }}>{f.description || '—'}</td>
                      <td>
                        <input type="checkbox" name="enabled" form={formId} defaultChecked={f.enabled} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            name="rollout_percent"
                            form={formId}
                            min={0}
                            max={100}
                            defaultValue={f.rollout_percent}
                            style={{ width: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12.5 }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stamp(f.updated_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <form id={formId} action={updateFlag.bind(null, f.key)} />
                          <button form={formId} className="filter-btn" style={{ padding: '6px 14px' }}>Save</button>
                          <form action={deleteFlag.bind(null, f.key)}>
                            <button className="filter-btn" style={{ padding: '6px 14px', color: 'var(--red)' }}>Delete</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} className="empty">No feature flags yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
