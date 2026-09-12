import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';

type Props = { searchParams: Promise<{ status?: string; page?: string }> };
const statuses = ['pending', 'approved', 'rejected'];
const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export default async function VerificationsPage({ searchParams }: Props) {
  const { status: requested, page: pageRaw } = await searchParams;
  const status = statuses.includes(requested ?? '') ? requested! : 'pending';
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();

  const [{ count: filteredTotal, error: countError }, { count: pendingCount, error: pendingError }] = await Promise.all([
    supabase.from('provider_verifications').select('*', { count: 'exact', head: true }).eq('status', status),
    supabase.from('provider_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: rows, error } = await supabase
    .from('provider_verifications')
    .select('id,status,submitted_at,profiles!provider_verifications_provider_id_fkey(full_name,provider_category,area)')
    .eq('status', status)
    .order('submitted_at', { ascending: true })
    .range(from, to);

  const errors = [countError?.message, pendingError?.message, error?.message];

  return (
    <>
      <div className="topline">
        <div>
          <p className="eyebrow">Trust & safety</p>
          <h1 className="heading">Provider verification</h1>
          <p className="intro">Review identity documents before a provider can carry the Solid Connect verification mark.</p>
        </div>
        <div className="stat">
          <b>{pendingCount ?? 0}</b>
          <span>awaiting review</span>
        </div>
      </div>
      <ErrorBanner errors={errors} />
      <nav className="tabs">
        {statuses.map(item => (
          <Link key={item} className={item === status ? 'selected' : ''} href={`/verifications?status=${item}`}>
            {item[0].toUpperCase() + item.slice(1)}
          </Link>
        ))}
      </nav>
      {rows?.length ? (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Trade</th>
                <th>Area</th>
                <th>Submitted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/verifications/${row.id}`}>
                      <strong>{row.profiles?.full_name ?? 'Unknown provider'}</strong>
                    </Link>
                    <br />
                    <span className="mono">{row.id.slice(0, 8)}</span>
                  </td>
                  <td>{row.profiles?.provider_category ?? '—'}</td>
                  <td>{row.profiles?.area ?? '—'}</td>
                  <td>{stamp(row.submitted_at)}</td>
                  <td>
                    <span className={`pill ${row.status}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total ?? 0} basePath="/verifications" params={{ status }} />
        </>
      ) : (
        <div className="empty">No {status} verification submissions.</div>
      )}
    </>
  );
}
