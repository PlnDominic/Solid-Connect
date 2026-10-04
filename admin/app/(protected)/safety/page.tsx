import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { phonesFor } from '../../../lib/phones';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { resolveSafetyAlert } from './actions';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));

export default async function SafetyPage({ searchParams }: Props) {
  const { status: requested, page: pageRaw } = await searchParams;
  const status = requested === 'resolved' ? 'resolved' : 'open';
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();

  const { count, error: countError } = await supabase
    .from('safety_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);
  const total = count ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;

  const { data: alerts, error: listError } = await supabase
    .from('safety_alerts')
    .select('id, user_id, job_id, lat, lng, note, status, admin_note, created_at, resolved_at')
    .eq('status', status)
    .order('created_at', { ascending: status === 'resolved' ? false : true })
    .range(from, from + PAGE_SIZE - 1);
  const rows = alerts ?? [];

  const userIds = [...new Set(rows.map((a) => a.user_id))];
  const jobIds = [...new Set(rows.map((a) => a.job_id).filter(Boolean))] as string[];

  const [{ data: people, error: peopleError }, { data: jobs, error: jobsError }] = await Promise.all([
    userIds.length
      ? supabase.from('profiles').select('id, full_name, email, role').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string | null; role: string }[], error: null }),
    jobIds.length
      ? supabase.from('jobs').select('id, title, location_label, customer_id, provider_id').in('id', jobIds)
      : Promise.resolve({ data: [] as { id: string; title: string; location_label: string; customer_id: string; provider_id: string }[], error: null }),
  ]);

  // A person in an emergency needs to be reachable: their number comes
  // from the admin-only phone lookup (phone isn't selectable, 0073).
  const phones = await phonesFor(supabase, userIds);
  const peopleMap = Object.fromEntries((people ?? []).map((p) => [p.id, { ...p, phone: phones[p.id] ?? null }]));
  const jobMap = Object.fromEntries((jobs ?? []).map((j) => [j.id, j]));

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Trust &amp; safety</div>
        <h1>Safety alerts</h1>
        <p className="page-header-sub">
          Raised from the Safety button on an active job. Call the person straight away, then record what you did.
        </p>
      </div>

      <ErrorBanner errors={[countError?.message, listError?.message, peopleError?.message, jobsError?.message]} />

      <nav className="tabs" style={{ margin: '0 0 14px' }}>
        {(['open', 'resolved'] as const).map((s) => (
          <Link key={s} href={`/safety?status=${s}`} className={status === s ? 'selected' : ''}>
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="empty">No {status} alerts.</div>
      ) : (
        <div className="stack-10">
          {rows.map((a) => {
            const person = peopleMap[a.user_id];
            const job = a.job_id ? jobMap[a.job_id] : undefined;
            const other = job ? (job.customer_id === a.user_id ? job.provider_id : job.customer_id) : null;
            return (
              <div key={a.id} className="panel">
                <div className="toolbar" style={{ marginBottom: 8 }}>
                  <div>
                    <span className={`pill ${a.status === 'open' ? 'rejected' : 'approved'}`}>{a.status === 'open' ? 'Needs follow-up' : 'Resolved'}</span>{' '}
                    <span className="text-muted-sm">{stamp(a.created_at)}</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--fs-md)' }}>
                  <strong>{person?.full_name ?? 'Unknown user'}</strong>{' '}
                  <span className="text-muted-md">({person?.role ?? 'user'})</span>
                </p>
                <p className="text-muted-md" style={{ margin: '4px 0 0' }}>
                  {person?.phone ? (
                    <>
                      Phone <a className="link-accent" href={`tel:${person.phone}`}>{person.phone}</a>
                    </>
                  ) : (
                    'No phone on file'
                  )}
                  {person?.email ? ` · ${person.email}` : ''}
                </p>
                {job ? (
                  <p className="text-muted-md" style={{ margin: '4px 0 0' }}>
                    Job:{' '}
                    <Link className="link-accent" href={`/jobs/${job.id}`}>
                      {job.title}
                    </Link>{' '}
                    at {job.location_label}
                    {other ? (
                      <>
                        {' '}
                        · other person{' '}
                        <Link className="link-accent" href={`/customers/${other}`}>
                          view
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {a.lat != null && a.lng != null ? (
                  <p className="text-muted-md" style={{ margin: '4px 0 0' }}>
                    Last known location:{' '}
                    <a className="link-accent" href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">
                      open in Maps
                    </a>
                  </p>
                ) : (
                  <p className="text-muted-md" style={{ margin: '4px 0 0' }}>No location shared.</p>
                )}
                {a.note ? <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)' }}>{a.note}</p> : null}

                {a.status === 'open' ? (
                  <form action={resolveSafetyAlert.bind(null, a.id)} className="mt-20" style={{ display: 'grid', gap: 8 }}>
                    <input name="note" className="search-input" placeholder="What did you do? (optional)" maxLength={500} />
                    <div>
                      <button className="filter-btn">Mark as resolved</button>
                    </div>
                  </form>
                ) : a.admin_note ? (
                  <p className="text-muted-md mt-20">Note: {a.admin_note}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/safety" params={{ status }} />
    </>
  );
}
