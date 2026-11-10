import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { closeJobPost, removeJobPost } from './actions';

type Props = { searchParams: Promise<{ status?: string; q?: string; id?: string; page?: string }> };

const statuses = ['all', 'open', 'expired', 'hired', 'closed'];
const statusLabels: Record<string, string> = { all: 'All', open: 'Open', expired: 'Expired', hired: 'Hired', closed: 'Closed' };

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const currency = (n: number | null | undefined) => (n == null ? '-' : `GH₵${Number(n).toLocaleString('en-US')}`);
const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PostRow = {
  id: string;
  customer_id: string;
  title: string;
  category_label: string;
  location_label: string;
  budget_type: string;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  interest_count: number;
  created_at: string;
  expires_at: string | null;
};

function budgetLabel(p: { budget_type: string; budget_min: number | null; budget_max: number | null }) {
  if (p.budget_type === 'negotiable' || (p.budget_min == null && p.budget_max == null)) return 'Open to offers';
  if (p.budget_type === 'fixed' || p.budget_min === p.budget_max) return currency(p.budget_max ?? p.budget_min);
  return `${currency(p.budget_min)} - ${currency(p.budget_max)}`;
}

export default async function JobPostsPage({ searchParams }: Props) {
  const { status: requested, q, id, page: pageRaw } = await searchParams;
  const status = statuses.includes(requested ?? '') ? requested! : 'all';
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();
  const term = q ? sanitizeForFilter(q) : '';
  const postId = id && UUID.test(id) ? id : '';
  const nowIso = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters = (query: any) => {
    let q2 = query;
    if (postId) q2 = q2.eq('id', postId);
    if (status === 'open') q2 = q2.eq('status', 'open').gt('expires_at', nowIso);
    else if (status === 'expired') q2 = q2.eq('status', 'open').lte('expires_at', nowIso);
    else if (status !== 'all') q2 = q2.eq('status', status);
    if (term) q2 = q2.or(`title.ilike.%${term}%,description.ilike.%${term}%,category_label.ilike.%${term}%,location_label.ilike.%${term}%`);
    return q2;
  };

  const { count, error: countError } = await filters(supabase.from('job_posts').select('id', { count: 'exact', head: true }));
  const total = count ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;

  const { data: posts, error: listError } = await filters(
    supabase
      .from('job_posts')
      .select(
        'id, customer_id, title, category_label, location_label, budget_type, budget_min, budget_max, status, interest_count, created_at, expires_at',
      ),
  )
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  const rows = (posts ?? []) as PostRow[];

  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))];
  const { data: customers, error: customersError } = customerIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', customerIds)
    : { data: [], error: null };
  const customerMap: Record<string, string | null> = {};
  for (const c of customers ?? []) customerMap[c.id] = c.full_name;

  const effective = (r: { status: string; expires_at: string | null }) =>
    r.status === 'open' && r.expires_at && new Date(r.expires_at).getTime() <= Date.now() ? 'expired' : r.status;
  const pill = (s: string) => (s === 'hired' ? 'approved' : s === 'open' ? 'pending' : 'rejected');

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Trust &amp; safety</div>
        <h1>Job posts</h1>
        <p className="page-header-sub">
          Jobs customers post to the board for every provider to see. Close a post to take it off the board, or remove it
          entirely. Reports about a post appear under User reports.
        </p>
      </div>

      <ErrorBanner errors={[countError?.message, listError?.message, customersError?.message]} />

      <div className="toolbar">
        <nav className="tabs m-0">
          {statuses.map((s) => (
            <Link key={s} className={s === status ? 'selected' : ''} href={`/job-posts?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>
              {statusLabels[s]}
            </Link>
          ))}
        </nav>
        <form>
          <input type="hidden" name="status" value={status} />
          <input type="text" name="q" defaultValue={q ?? ''} placeholder="Search job posts..." className="search-input" style={{ width: 240 }} />
        </form>
      </div>

      {postId ? (
        <p className="text-muted-md">
          Showing one post. <Link className="link-accent" href="/job-posts">Show all</Link>
        </p>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Customer</th>
              <th>Location</th>
              <th>Budget</th>
              <th>Interested</th>
              <th>Status</th>
              <th>Posted</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty">
                  No job posts match this filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const s = effective(r);
                return (
                  <tr key={r.id}>
                    <td>
                      {r.title}
                      <div className="mono" style={{ opacity: 0.7, marginTop: 2 }}>{r.category_label}</div>
                    </td>
                    <td>
                      <Link href={`/customers/${r.customer_id}`}>{customerMap[r.customer_id] ?? 'Customer'}</Link>
                    </td>
                    <td>{r.location_label || '-'}</td>
                    <td>{budgetLabel(r)}</td>
                    <td>{r.interest_count}</td>
                    <td>
                      <span className={`pill ${pill(s)}`}>{statusLabels[s] ?? s}</span>
                    </td>
                    <td>{stamp(r.created_at)}</td>
                    <td>{r.expires_at ? stamp(r.expires_at) : '-'}</td>
                    <td>
                      <form className="flex-gap-8">
                        {s === 'open' ? (
                          <button className="filter-btn" formAction={closeJobPost.bind(null, r.id)}>
                            Close
                          </button>
                        ) : null}
                        <button className="filter-btn" formAction={removeJobPost.bind(null, r.id)}>
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/job-posts" params={{ status, ...(q ? { q } : {}) }} />
    </>
  );
}
