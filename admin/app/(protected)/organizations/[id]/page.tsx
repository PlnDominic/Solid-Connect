import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '../../../../lib/admin';

const stamp = (date: string | null | undefined) =>
  date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '—';
const currency = (n: number | null | undefined) => (n == null ? '—' : `GH₵${n.toLocaleString('en-US')}`);

export const dynamic = 'force-dynamic';

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: org } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle();
  if (!org) notFound();

  const [{ data: owner }, { data: members }, { data: projects }, { data: requests }, { data: recurring }] =
    await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('id', org.owner_id).maybeSingle(),
      supabase
        .from('organization_members')
        .select('profile_id, role, created_at, profiles(id, full_name)')
        .eq('organization_id', id)
        .order('created_at', { ascending: true }),
      supabase.from('projects').select('*').eq('organization_id', id).order('created_at', { ascending: false }),
      supabase
        .from('service_requests')
        .select('id, category_label, status, location_label, customer_budget, created_at, project_id')
        .eq('organization_id', id)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('recurring_services')
        .select('*')
        .eq('organization_id', id)
        .order('created_at', { ascending: false }),
    ]);

  return (
    <>
      <Link className="mono" href="/organizations">
        ← Back to organizations
      </Link>

      <div className="topline mt-20">
        <div>
          <p className="eyebrow">Organization</p>
          <h1 className="heading">{org.name}</h1>
          <p className="intro">{org.area || 'No area'} · {org.email || org.phone || 'No contact'}</p>
        </div>
        <span className={`pill ${org.status === 'active' ? 'approved' : org.status === 'suspended' ? 'rejected' : 'pending'}`}>
          {org.status}
        </span>
      </div>

      <div className="detail">
        <section className="panel">
          <h2>Profile</h2>
          <div className="facts">
            <div>
              <label>Owner</label>
              <strong>
                {owner ? <Link href={`/customers/${owner.id}`}>{owner.full_name}</Link> : '—'}
              </strong>
            </div>
            <div>
              <label>Phone</label>
              <strong>{org.phone || '—'}</strong>
            </div>
            <div>
              <label>Email</label>
              <strong>{org.email || '—'}</strong>
            </div>
            <div>
              <label>Created</label>
              <strong>{stamp(org.created_at)}</strong>
            </div>
          </div>
          {org.description ? (
            <>
              <h2 className="mt-28">Description</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{org.description}</p>
            </>
          ) : null}

          <h2 className="mt-28">Members ({members?.length ?? 0})</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m: any) => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                return (
                  <tr key={m.profile_id}>
                    <td>
                      <Link href={`/customers/${m.profile_id}`}>{profile?.full_name ?? m.profile_id}</Link>
                    </td>
                    <td>{m.role}</td>
                    <td>{stamp(m.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Projects ({projects?.length ?? 0})</h2>
          {(projects ?? []).length === 0 ? (
            <p className="text-muted-md">No projects yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {(projects ?? []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.status.replaceAll('_', ' ')}</td>
                    <td>{p.location_label || '—'}</td>
                    <td>{stamp(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="mt-28">Workforce requests ({requests?.length ?? 0})</h2>
          {(requests ?? []).length === 0 ? (
            <p className="text-muted-md">No workforce requests yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(requests ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/requests/${r.id}`}>{r.category_label}</Link>
                    </td>
                    <td>{currency(r.customer_budget)}</td>
                    <td>{r.status.replaceAll('_', ' ')}</td>
                    <td>{stamp(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="mt-28">Recurring services ({recurring?.length ?? 0})</h2>
          {(recurring ?? []).length === 0 ? (
            <p className="text-muted-md">No recurring schedules.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Cadence</th>
                  <th>Next run</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {(recurring ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.category_label}
                      <div className="mono" style={{ opacity: 0.7 }}>
                        {currency(r.budget)} · {r.location_label}
                      </div>
                    </td>
                    <td>{r.cadence}</td>
                    <td>{stamp(r.next_run_at)}</td>
                    <td>{r.active ? 'Yes' : 'Paused'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
