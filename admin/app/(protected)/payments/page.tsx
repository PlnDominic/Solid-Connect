import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SortHeader } from '../../components/SortHeader';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { setPaymentStatus } from './actions';

type Props = { searchParams: Promise<{ status?: string; page?: string; sort?: string; dir?: string }> };
const statuses = ['all', 'pending', 'released', 'refunded'];
const currency = (n: number) => `GH₵${(n ?? 0).toLocaleString('en-US')}`;
const stamp = (date: string | null) => (date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date)) : '—');
const SORTABLE = ['amount', 'status', 'created_at'];

export default async function PaymentsPage({ searchParams }: Props) {
  const { status: requested, page: pageRaw, sort: sortRaw, dir: dirRaw } = await searchParams;
  const status = statuses.includes(requested ?? '') ? requested! : 'all';
  const requestedPage = parsePage(pageRaw);
  const sort = SORTABLE.includes(sortRaw ?? '') ? sortRaw! : 'created_at';
  const dir: 'asc' | 'desc' = dirRaw === 'asc' ? 'asc' : 'desc';
  const supabase = await createServerSupabase();

  const countQuery = () => {
    let q = supabase.from('payments').select('id', { count: 'exact', head: true });
    if (status !== 'all') q = q.eq('status', status);
    return q;
  };
  const withTab = (s?: string) => {
    let q = supabase.from('payments').select('amount', { count: 'exact' });
    if (s) q = q.eq('status', s);
    return q;
  };

  const [
    { count: filteredTotal, error: countError },
    { data: releasedRows, error: releasedError },
    { data: pendingRows, error: pendingError },
    { data: refundedRows, error: refundedError },
  ] = await Promise.all([countQuery(), withTab('released'), withTab('pending'), withTab('refunded')]);

  const sum = (rows: { amount: number }[] | null) => (rows ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalReleased = sum(releasedRows);
  const totalPending = sum(pendingRows);
  const totalRefunded = sum(refundedRows);

  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let dataQuery = supabase.from('payments').select('id, job_id, amount, status, released_at, created_at, refund_reason');
  if (status !== 'all') dataQuery = dataQuery.eq('status', status);
  const { data: payments, error: listError } = await dataQuery.order(sort, { ascending: dir === 'asc' }).range(from, to);

  const rows = payments ?? [];
  const jobIds = [...new Set(rows.map((p) => p.job_id).filter(Boolean))];
  const { data: jobs, error: jobsError } = jobIds.length
    ? await supabase.from('jobs').select('id, title, customer_id, provider_id').in('id', jobIds)
    : { data: [], error: null };

  const peopleIds = [...new Set((jobs ?? []).flatMap((j) => [j.customer_id, j.provider_id]).filter(Boolean))];
  const { data: people, error: peopleError } = peopleIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', peopleIds)
    : { data: [], error: null };

  const errors = [countError?.message, releasedError?.message, pendingError?.message, refundedError?.message, listError?.message, jobsError?.message, peopleError?.message];

  const jobMap: Record<string, any> = {};
  (jobs ?? []).forEach((j) => { jobMap[j.id] = j; });
  const nameMap: Record<string, string> = {};
  (people ?? []).forEach((p) => { nameMap[p.id] = p.full_name; });

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Money</div>
        <h1>Payments</h1>
        <p className="page-header-sub">Every payment on the platform - simulated until a real payment gateway is connected.</p>
      </div>

      <ErrorBanner errors={errors} />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Released</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{currency(totalReleased)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Pending</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{currency(totalPending)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Refunded</div>
          <div className="stat-card-value" style={{ color: 'var(--red)' }}>{currency(totalRefunded)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <nav className="tabs" style={{ margin: 0 }}>
          {statuses.map((s) => (
            <Link key={s} href={`/payments?status=${s}`} className={s === status ? 'selected' : ''}>
              {s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </nav>
        <a href={`/api/export/payments?status=${status}`} className="filter-btn">Export CSV</a>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Customer</th>
              <th>Provider</th>
              <SortHeader label="Amount" field="amount" currentSort={sort} currentDir={dir} basePath="/payments" params={{ status }} />
              <SortHeader label="Status" field="status" currentSort={sort} currentDir={dir} basePath="/payments" params={{ status }} />
              <SortHeader label="Created" field="created_at" currentSort={sort} currentDir={dir} basePath="/payments" params={{ status }} />
              <th>Override</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((p) => {
              const job = jobMap[p.job_id];
              return (
                <tr key={p.id}>
                  <td>
                    {job ? <Link href={`/jobs/${job.id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{job.title || 'Untitled'}</Link> : '—'}
                    {p.refund_reason && <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 2 }}>Refunded: {p.refund_reason}</div>}
                  </td>
                  <td>{job ? nameMap[job.customer_id] ?? '—' : '—'}</td>
                  <td>{job ? nameMap[job.provider_id] ?? '—' : '—'}</td>
                  <td style={{ fontWeight: 700 }}>{currency(p.amount)}</td>
                  <td>
                    <span className={`pill ${p.status === 'released' ? 'approved' : p.status === 'refunded' ? 'rejected' : 'pending'}`}>{p.status}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stamp(p.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.status !== 'released' && (
                        <form action={setPaymentStatus.bind(null, p.id, 'released', '')}>
                          <button className="filter-btn" style={{ padding: '6px 12px' }}>Release</button>
                        </form>
                      )}
                      {p.status !== 'refunded' && (
                        <form action={setPaymentStatus.bind(null, p.id, 'refunded', 'Manual admin override')}>
                          <button className="filter-btn" style={{ padding: '6px 12px' }}>Refund</button>
                        </form>
                      )}
                      {p.status !== 'pending' && (
                        <form action={setPaymentStatus.bind(null, p.id, 'pending', '')}>
                          <button className="filter-btn" style={{ padding: '6px 12px' }}>Reset</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7} className="empty">No payments found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/payments" params={{ status }} />
    </>
  );
}
