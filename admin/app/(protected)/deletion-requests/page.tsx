import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { contactsFor } from '../../../lib/phones';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { addEmailedDeletionRequest, completeAccountDeletion, dismissAccountDeletion } from './actions';

type Props = { searchParams: Promise<{ status?: string; page?: string; added?: string }> };

const ADDED_MESSAGES: Record<string, string> = {
  ok: 'Request added to the pending list.',
  none: 'No account uses that email address.',
  several: 'More than one account uses that email address. Check them under Customers and Providers before going further.',
  pending: 'That account already has a pending request.',
  admin: 'That is an admin account. Remove its admin access first.',
};

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function DeletionRequestsPage({ searchParams }: Props) {
  const { status: requested, page: pageRaw, added } = await searchParams;
  const status = requested === 'completed' || requested === 'cancelled' ? requested : 'pending';
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();

  const { count: filteredTotal, error: countError } = await supabase
    .from('account_deletion_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);

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
    ? await supabase.from('profiles').select('id, full_name, role').in('id', userIds)
    : { data: [] as { id: string; full_name: string; role: string }[], error: null };
  // email is hidden from signed-in users (0076) - admin-only lookup.
  const contacts = await contactsFor(supabase, userIds);

  const errors = [countError?.message, listError?.message, peopleError?.message];

  const peopleMap: Record<string, { full_name: string; email: string | null; role: string }> = {};
  people?.forEach((p) => {
    peopleMap[p.id] = { ...p, email: contacts[p.id]?.email ?? null };
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Trust & safety</div>
        <h1>Account deletion requests</h1>
        <p className="page-header-sub">
          Requests from the app and ones added from email. Completing one deletes the sign-in account, the ID, profile
          and portfolio files, and the profile details. Request, chat, voice and dispute files are kept, as is history
          tied to other people&apos;s accounts.
        </p>
      </div>

      <ErrorBanner errors={errors} />

      <form action={addEmailedDeletionRequest} style={{ margin: '0 0 14px' }}>
        <p className="text-muted-sm">
          Got a request by email? First check that it came from the account&apos;s own address, then add it here.
        </p>
        <div className="flex-gap-8" style={{ flexWrap: 'wrap', marginTop: 8 }}>
          <input
            type="email"
            name="email"
            required
            className="input"
            style={{ width: 280, maxWidth: '100%' }}
            placeholder="Account email address"
            aria-label="Account email address"
          />
          <button className="filter-btn">Add request</button>
        </div>
        {added && ADDED_MESSAGES[added] ? (
          <p role="status" style={{ marginTop: 8 }}>{ADDED_MESSAGES[added]}</p>
        ) : null}
      </form>

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
                    <div className="fw-500">{person?.full_name ?? r.user_id.slice(0, 8)}</div>
                    <div className="text-muted-sm">
                      {person?.email ?? '-'} · {person?.role ?? '-'}
                    </div>
                  </td>
                  <td style={{ maxWidth: 280 }}>{r.reason || <span className="text-muted">No reason given</span>}</td>
                  <td className="text-muted-sm">{stamp(r.requested_at)}</td>
                  {status !== 'pending' && (
                    <td className="text-muted-sm">{r.admin_note || '-'}</td>
                  )}
                  {status === 'pending' && (
                    <td>
                      <div className="flex-gap-8">
                        <form action={completeAccountDeletion.bind(null, r.id)}>
                          <button className="filter-btn" style={{ color: 'var(--red)' }}>
                            Complete deletion
                          </button>
                        </form>
                        <form action={dismissAccountDeletion.bind(null, r.id)}>
                          <button className="filter-btn">Dismiss</button>
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
