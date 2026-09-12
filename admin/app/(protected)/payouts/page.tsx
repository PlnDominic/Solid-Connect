import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { markPayoutPaid } from './actions';

type Props = { searchParams: Promise<{ status?: string; page?: string }> };
const statuses = ['all', 'pending', 'paid', 'failed'];
const currency = (n: number) => `GH₵${(n ?? 0).toLocaleString('en-US')}`;
const stamp = (date: string | null) => (date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date)) : '—');

export default async function PayoutsPage({ searchParams }: Props) {
  const { status: requested, page: pageRaw } = await searchParams;
  const status = statuses.includes(requested ?? '') ? requested! : 'pending';
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();

  const countQuery = () => {
    let q = supabase.from('provider_payouts').select('id', { count: 'exact', head: true });
    if (status !== 'all') q = q.eq('status', status);
    return q;
  };
  const sumByStatus = (s: string) => supabase.from('provider_payouts').select('net_amount').eq('status', s);

  const [
    { count: filteredTotal, error: countError },
    { data: pendingRows, error: pendingError },
    { data: paidRows, error: paidError },
  ] = await Promise.all([countQuery(), sumByStatus('pending'), sumByStatus('paid')]);

  const sum = (rows: { net_amount: number }[] | null) => (rows ?? []).reduce((s, r) => s + (r.net_amount ?? 0), 0);
  const totalPending = sum(pendingRows);
  const totalPaid = sum(paidRows);

  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let dataQuery = supabase
    .from('provider_payouts')
    .select('id, payment_id, provider_id, gross_amount, commission_amount, net_amount, status, payout_method, payout_reference, created_at, paid_at');
  if (status !== 'all') dataQuery = dataQuery.eq('status', status);
  const { data: payouts, error: listError } = await dataQuery.order('created_at', { ascending: false }).range(from, to);

  const rows = payouts ?? [];
  const providerIds = [...new Set(rows.map((r) => r.provider_id).filter(Boolean))];
  const paymentIds = [...new Set(rows.map((r) => r.payment_id).filter(Boolean))];

  const [{ data: providers, error: providersError }, { data: payments, error: paymentsError }] = await Promise.all([
    providerIds.length ? supabase.from('profiles').select('id, full_name, initials').in('id', providerIds) : { data: [], error: null },
    paymentIds.length ? supabase.from('payments').select('id, job_id').in('id', paymentIds) : { data: [], error: null },
  ]);

  const jobIds = [...new Set((payments ?? []).map((p) => p.job_id).filter(Boolean))];
  const { data: jobs, error: jobsError } = jobIds.length ? await supabase.from('jobs').select('id, title').in('id', jobIds) : { data: [], error: null };

  const errors = [countError?.message, pendingError?.message, paidError?.message, listError?.message, providersError?.message, paymentsError?.message, jobsError?.message];

  const providerMap: Record<string, any> = {};
  (providers ?? []).forEach((p) => { providerMap[p.id] = p; });
  const paymentToJob: Record<string, string> = {};
  (payments ?? []).forEach((p) => { paymentToJob[p.id] = p.job_id; });
  const jobMap: Record<string, any> = {};
  (jobs ?? []).forEach((j) => { jobMap[j.id] = j; });

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Money</div>
        <h1>Payouts</h1>
        <p className="page-header-sub">What Solid Connect owes providers, net of commission - the second leg of each payment.</p>
      </div>

      <ErrorBanner errors={errors} />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Owed (pending)</div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>{currency(totalPending)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Paid out</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{currency(totalPaid)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <nav className="tabs" style={{ margin: 0 }}>
          {statuses.map((s) => (
            <Link key={s} href={`/payouts?status=${s}`} className={s === status ? 'selected' : ''}>
              {s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </nav>
        <a href={`/api/export/payouts?status=${status}`} className="filter-btn">Export CSV</a>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Job</th>
              <th>Gross</th>
              <th>Commission</th>
              <th>Net Payout</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((r) => {
              const provider = providerMap[r.provider_id];
              const jobId = paymentToJob[r.payment_id];
              const job = jobId ? jobMap[jobId] : null;
              return (
                <tr key={r.id}>
                  <td>
                    {provider ? (
                      <div className="profile-cell">
                        <div className="profile-avatar" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', width: 28, height: 28, fontSize: 10 }}>{provider.initials}</div>
                        <Link href={`/providers/${r.provider_id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{provider.full_name}</Link>
                      </div>
                    ) : '—'}
                  </td>
                  <td>{job ? <Link href={`/jobs/${job.id}`} style={{ color: 'var(--accent-text)' }}>{job.title || 'Untitled'}</Link> : '—'}</td>
                  <td>{currency(r.gross_amount)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>-{currency(r.commission_amount)}</td>
                  <td style={{ fontWeight: 700 }}>{currency(r.net_amount)}</td>
                  <td>
                    <span className={`pill ${r.status === 'paid' ? 'approved' : r.status === 'failed' ? 'rejected' : 'pending'}`}>{r.status}</span>
                    {r.status === 'paid' && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                        {r.payout_method}{r.payout_reference ? ` · ${r.payout_reference}` : ''} · {stamp(r.paid_at)}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.status === 'pending' ? (
                      <form action={markPayoutPaid.bind(null, r.id)} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <select
                          name="method"
                          required
                          defaultValue=""
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
                        >
                          <option value="" disabled>Method</option>
                          <option value="MTN MoMo">MTN MoMo</option>
                          <option value="Vodafone Cash">Vodafone Cash</option>
                          <option value="AirtelTigo Money">AirtelTigo Money</option>
                          <option value="Bank transfer">Bank transfer</option>
                        </select>
                        <input name="reference" placeholder="Reference (optional)" style={{ width: 130, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }} />
                        <button className="filter-btn" style={{ padding: '6px 12px' }}>Mark paid</button>
                      </form>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7} className="empty">No payouts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/payouts" params={{ status }} />
    </>
  );
}
