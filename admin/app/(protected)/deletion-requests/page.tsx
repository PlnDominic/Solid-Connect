import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { completeAccountDeletion, dismissAccountDeletion } from './actions';

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function DeletionRequestsPage({ searchParams }: Props) {
  const { status: requested, page: pageRaw } = await searchParams;
  const status = requested === 'completed' || requested === 'cancelled' ? requested : 'pending';
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();

  const [
    { count: filteredTotal, error: countError },
    { count: pendingCount, error: pendingError },
  ] = await Promise.all([
    supabase.from('account_deletion_requests').select('*', { count: 'exact', head: true }).eq('status', status),
    supabase.from('account_deletion_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: requests, error: listError } = await supabase
    .from('account_deletion_requests')
    .select('id, user_id, reason, status, requested_at, reviewed_at, admin_note')
    .eq('status', status)
    .order('requested_at', { ascending: status === 'pending' })
    .range(from, to);

  const rows = requests ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const { data: people, error: peopleError } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, email, role').in('id', userIds)
    : { data: [] as { id: string; full_name: string; email: string | null; role: string }[], error: null };

  const errors = [countError?.message, listError?.message, pendingError?.message, peopleError?.message];

  const peopleMap: Record<string, { full_name: string; email: string | null; role: string }> = {};
  people?.forEach((p) => {
    peopleMap[p.id] = p;
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Trust & safety</div>
        <h1>Account deletion requests</h1>
        <p className="page-header-sub">
          Self-service requests from Settings → Account security. Completing one deletes the real sign-in account and
          anonymizes the profile; job/payment/review history tied to other people&apos;s accounts is kept, same as a
          removed review only recalculating a rating.
        </p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Pending</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{pendingCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Listed</div>
          <div className="stat-card-value">{total ?? 0}</div>
        </div>
      </div>

      <ErrorBanner errors={errors} />

      <nav className="tabs" style={{ margin: '0 0 14px' }}>
        {(['pending', 'completed', 'cancelled'] as const).map((s) => (
          <Link key={s} href={`/deletion-requests?status=${s}`} className={status === s ? 'selected' : ''}>
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </nav>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Reason</th>
              <th>Requested</th>
              {status !== 'pending' && <th>Admin note</th>}
              {status === 'pending' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((r) => {
              const person = peopleMap[r.user_id];
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{person?.full_name ?? r.user_id.slice(0, 8)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {person?.email ?? '—'} · {person?.role ?? '—'}
                    </div>
                  </td>
                  <td style={{ maxWidth: 280 }}>{r.reason || <span style={{ color: 'var(--text-muted)' }}>No reason given</span>}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stamp(r.requested_at)}</td>
                  {status !== 'pending' && (
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.admin_note || '—'}</td>
                  )}
                  {status === 'pending' && (
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <form action={completeAccountDeletion.bind(null, r.id)}>
                          <button className="filter-btn" style={{ padding: '6px 14px', color: 'var(--red)' }}>
                            Complete deletion
                          </button>
                        </form>
                        <form action={dismissAccountDeletion.bind(null, r.id)}>
                          <button className="filter-btn" style={{ padding: '6px 14px' }}>Dismiss</button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              );
            }) : (
              <tr><td colSpan={status === 'pending' ? 4 : 4} className="empty">No {status} requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total ?? 0} basePath="/deletion-requests" params={{ status }} />
    </>
  );
}
