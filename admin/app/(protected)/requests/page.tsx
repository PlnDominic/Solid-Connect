import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { SortHeader } from '../../components/SortHeader';

type Props = { searchParams: Promise<{ status?: string; mode?: string; q?: string; page?: string; sort?: string; dir?: string }> };

const statuses = ['all', 'open', 'matching', 'awaiting_provider', 'quoted', 'accepted', 'completed', 'cancelled', 'rejected'];
const statusLabels: Record<string, string> = {
  all: 'All',
  open: 'Open',
  matching: 'Matching',
  awaiting_provider: 'Awaiting provider',
  quoted: 'Quoted',
  accepted: 'Accepted',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};
const statusPill = (s: string) =>
  s === 'completed' || s === 'accepted' ? 'approved' : s === 'cancelled' || s === 'rejected' ? 'rejected' : 'pending';

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const currency = (n: number | null | undefined) => (n == null ? '—' : `GH₵${n.toLocaleString('en-US')}`);
const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();
const SORTABLE = ['created_at', 'status', 'category_label', 'location_label', 'customer_budget'];

export default async function RequestsPage({ searchParams }: Props) {
  const { status: requested, mode: modeRaw, q, page: pageRaw, sort: sortRaw, dir: dirRaw } = await searchParams;
  const status = statuses.includes(requested ?? '') ? requested! : 'all';
  const mode = modeRaw === 'DIRECT' || modeRaw === 'GENERAL' ? modeRaw : 'all';
  const requestedPage = parsePage(pageRaw);
  const sort = SORTABLE.includes(sortRaw ?? '') ? sortRaw! : 'created_at';
  const dir: 'asc' | 'desc' = dirRaw === 'asc' ? 'asc' : 'desc';
  const supabase = await createServerSupabase();
  const term = q ? sanitizeForFilter(q) : '';

  const countQuery = () => {
    let q2 = supabase.from('service_requests').select('id', { count: 'exact', head: true });
    if (status !== 'all') q2 = q2.eq('status', status);
    if (mode !== 'all') q2 = q2.eq('request_mode', mode);
    if (term) q2 = q2.or(`description.ilike.%${term}%,category_label.ilike.%${term}%,location_label.ilike.%${term}%`);
    return q2;
  };
  const dataQuery = () => {
    let q2 = supabase
      .from('service_requests')
      .select(
        'id, customer_id, category_label, description, location_label, status, request_mode, customer_budget, budget_min, budget_max, preferred_provider_id, organization_id, created_at',
      );
    if (status !== 'all') q2 = q2.eq('status', status);
    if (mode !== 'all') q2 = q2.eq('request_mode', mode);
    if (term) q2 = q2.or(`description.ilike.%${term}%,category_label.ilike.%${term}%,location_label.ilike.%${term}%`);
    return q2;
  };

  const { count: filteredTotal, error: countError } = await countQuery();
  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: requests, error: listError } = await dataQuery().order(sort, { ascending: dir === 'asc' }).range(from, to);
  const rows = requests ?? [];

  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))];
  const { data: customers, error: customersError } = customerIds.length
    ? await supabase.from('profiles').select('id, full_name, initials').in('id', customerIds)
    : { data: [], error: null };
  const customerMap: Record<string, { full_name: string | null; initials: string | null }> = {};
  for (const c of customers ?? []) customerMap[c.id] = c;

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Operations</div>
        <h1>Requests</h1>
        <p className="page-header-sub">Monitor open and closed service requests before they become jobs.</p>
      </div>

      <ErrorBanner errors={[countError?.message, listError?.message, customersError?.message]} />

      <div className="toolbar">
        <nav className="tabs m-0">
          {statuses.map((s) => (
            <Link
              key={s}
              className={s === status ? 'selected' : ''}
              href={`/requests?status=${s}${mode !== 'all' ? `&mode=${mode}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            >
              {statusLabels[s]}
            </Link>
          ))}
        </nav>
        <nav className="tabs m-0">
          {(['all', 'GENERAL', 'DIRECT'] as const).map((m) => (
            <Link
              key={m}
              className={m === mode ? 'selected' : ''}
              href={`/requests?mode=${m}${status !== 'all' ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            >
              {m === 'all' ? 'All modes' : m === 'GENERAL' ? 'Open market' : 'Direct'}
            </Link>
          ))}
        </nav>
        <form>
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="mode" value={mode} />
          <input type="text" name="q" defaultValue={q ?? ''} placeholder="Search requests..." className="search-input" style={{ width: 240 }} />
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortHeader label="Category" field="category_label" currentSort={sort} currentDir={dir} basePath="/requests" params={{ status, mode, q }} />
              <th>Customer</th>
              <SortHeader label="Location" field="location_label" currentSort={sort} currentDir={dir} basePath="/requests" params={{ status, mode, q }} />
              <SortHeader label="Budget" field="customer_budget" currentSort={sort} currentDir={dir} basePath="/requests" params={{ status, mode, q }} />
              <SortHeader label="Status" field="status" currentSort={sort} currentDir={dir} basePath="/requests" params={{ status, mode, q }} />
              <th>Mode</th>
              <SortHeader label="Created" field="created_at" currentSort={sort} currentDir={dir} basePath="/requests" params={{ status, mode, q }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  No requests match this filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const customer = customerMap[r.customer_id];
                const budget = r.customer_budget ?? r.budget_max ?? r.budget_min;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/requests/${r.id}`}>{r.category_label || 'Request'}</Link>
                      <div className="mono" style={{ opacity: 0.7, marginTop: 2 }}>
                        {(r.description || '').slice(0, 72)}
                        {(r.description || '').length > 72 ? '…' : ''}
                        {r.organization_id ? ' · org' : ''}
                      </div>
                    </td>
                    <td>
                      {customer ? (
                        <Link href={`/customers/${r.customer_id}`}>{customer.full_name ?? customer.initials ?? 'Customer'}</Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{r.location_label || '—'}</td>
                    <td>{currency(budget)}</td>
                    <td>
                      <span className={`pill ${statusPill(r.status)}`}>{statusLabels[r.status] ?? r.status}</span>
                    </td>
                    <td>{r.request_mode === 'DIRECT' ? 'Direct' : 'Open market'}</td>
                    <td>{stamp(r.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/requests" params={{ status, mode, ...(q ? { q } : {}) }} />
    </>
  );
}
