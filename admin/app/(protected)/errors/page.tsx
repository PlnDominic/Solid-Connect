import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';

type Props = { searchParams: Promise<{ page?: string; fatal?: string }> };

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));

export default async function ErrorsPage({ searchParams }: Props) {
  const { page: pageRaw, fatal } = await searchParams;
  const onlyFatal = fatal === '1';
  const supabase = await createServerSupabase();

  let countQuery = supabase.from('client_errors').select('*', { count: 'exact', head: true });
  if (onlyFatal) countQuery = countQuery.eq('fatal', true);
  const { count, error: countError } = await countQuery;
  const total = count ?? 0;
  const page = clampPage(parsePage(pageRaw), total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;

  let listQuery = supabase.from('client_errors').select('*').order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (onlyFatal) listQuery = listQuery.eq('fatal', true);
  const { data, error: listError } = await listQuery;
  const rows = data ?? [];

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Operations</div>
        <h1>App errors</h1>
        <p className="page-header-sub">
          Crashes and unexpected errors reported by the mobile app. Each distinct error is reported once per app run. Look for the same
          message across many users or one screen, and for new messages right after a release.
        </p>
      </div>

      <ErrorBanner errors={[countError?.message, listError?.message]} />

      <nav className="tabs" style={{ margin: '0 0 14px' }}>
        <a href="/errors" className={!onlyFatal ? 'selected' : ''}>All</a>
        <a href="/errors?fatal=1" className={onlyFatal ? 'selected' : ''}>Crashes only</a>
      </nav>

      {rows.length === 0 ? (
        <div className="empty">No errors reported.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Message</th>
                <th>Screen</th>
                <th>Build</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{stamp(r.created_at)}</td>
                  <td>
                    <strong>{r.fatal ? 'Crash: ' : ''}</strong>
                    {r.message}
                    {r.stack ? (
                      <details>
                        <summary>Stack</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{r.stack}</pre>
                      </details>
                    ) : null}
                  </td>
                  <td>{r.screen ?? '-'}</td>
                  <td>
                    {r.platform ?? '-'} {r.app_version ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/errors" params={onlyFatal ? { fatal: '1' } : {}} />
    </>
  );
}
