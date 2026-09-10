import { createServerSupabase } from '../../lib/supabase';
import { resolveDispute } from './actions';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../components/Pagination';

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

const reasonLabel: Record<string, string> = {
  not_completed: 'Not completed',
  poor_quality: 'Poor quality',
  overcharged: 'Overcharged',
  no_show: 'No-show',
  other: 'Other',
};

export default async function DisputesPage({ searchParams }: Props) {
  const { status: requested, page: pageRaw } = await searchParams;
  const status = requested === 'resolved' || requested === 'open' ? requested : 'open';
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();

  const [
    { count: filteredTotal, error: countError },
    // "Open" stat is a standing queue signal - always the true global open
    // count, not scoped to whichever tab you happen to be viewing.
    { count: openCount, error: openError },
  ] = await Promise.all([
    supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', status),
    supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: disputes, error: listError } = await supabase
    .from('disputes')
    .select('id, job_id, customer_id, provider_id, reason, description, status, resolution_note, created_at, resolved_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(from, to);

  const rows = disputes ?? [];
  const ids = [...new Set(rows.flatMap((d) => [d.customer_id, d.provider_id].filter(Boolean)))];
  const jobIds = [...new Set(rows.map((d) => d.job_id).filter(Boolean))];

  const [{ data: people, error: peopleError }, { data: jobs, error: jobsError }] = await Promise.all([
    ids.length
      ? supabase.from('profiles').select('id, full_name').in('id', ids)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
    jobIds.length
      ? supabase.from('jobs').select('id, title').in('id', jobIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
  ]);

  const errors = [countError?.message, listError?.message, openError?.message, peopleError?.message, jobsError?.message];

  const nameMap: Record<string, string> = {};
  people?.forEach((p) => {
    nameMap[p.id] = p.full_name;
  });
  const jobMap: Record<string, string> = {};
  jobs?.forEach((j) => {
    jobMap[j.id] = j.title;
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Trust & safety</div>
        <h1>Disputes</h1>
        <p className="page-header-sub">Customer-filed complaints on jobs. Resolve with a clear note for both sides.</p>
      </div>

      <ErrorBanner errors={errors} />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Open</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>
            {openCount ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Listed</div>
          <div className="stat-card-value">{total ?? 0}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['open', 'resolved'] as const).map((s) => (
          <a
            key={s}
            href={`/disputes?status=${s}`}
            className="button"
            style={{
              opacity: status === s ? 1 : 0.55,
              textDecoration: 'none',
            }}
          >
            {s === 'open' ? 'Open' : 'Resolved'}
          </a>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Reason</th>
              <th>Customer</th>
              <th>Provider</th>
              <th>Opened</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>No disputes in this filter.</td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{jobMap[d.job_id] ?? d.job_id.slice(0, 8)}</div>
                    <div style={{ opacity: 0.65, fontSize: 12, marginTop: 4 }}>{d.description}</div>
                    {d.resolution_note ? (
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>Resolved: {d.resolution_note}</div>
                    ) : null}
                  </td>
                  <td>{reasonLabel[d.reason] ?? d.reason}</td>
                  <td>{nameMap[d.customer_id] ?? '—'}</td>
                  <td>{nameMap[d.provider_id] ?? '—'}</td>
                  <td>{stamp(d.created_at)}</td>
                  <td>
                    {d.status === 'open' ? (
                      <form action={resolveDispute.bind(null, d.id)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          name="note"
                          required
                          placeholder="Resolution note"
                          style={{ minWidth: 160, padding: '6px 8px' }}
                        />
                        <button className="button" type="submit">
                          Resolve
                        </button>
                      </form>
                    ) : (
                      <span style={{ opacity: 0.6 }}>Closed {d.resolved_at ? stamp(d.resolved_at) : ''}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total ?? 0} basePath="/disputes" params={{ status }} />
    </>
  );
}
