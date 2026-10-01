import Link from 'next/link';
import { createAdminClient } from '../../../lib/admin';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';

type Props = { searchParams: Promise<{ status?: string; q?: string; page?: string }> };

const statuses = ['all', 'active', 'suspended', 'archived'];
const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();

export const dynamic = 'force-dynamic';

export default async function OrganizationsPage({ searchParams }: Props) {
  const { status: requested, q, page: pageRaw } = await searchParams;
  const status = statuses.includes(requested ?? '') ? requested! : 'all';
  const requestedPage = parsePage(pageRaw);
  const term = q ? sanitizeForFilter(q) : '';
  const supabase = createAdminClient();

  const countQuery = () => {
    let q2 = supabase.from('organizations').select('id', { count: 'exact', head: true });
    if (status !== 'all') q2 = q2.eq('status', status);
    if (term) q2 = q2.or(`name.ilike.%${term}%,area.ilike.%${term}%,email.ilike.%${term}%`);
    return q2;
  };
  const dataQuery = () => {
    let q2 = supabase
      .from('organizations')
      .select('id, name, area, email, phone, status, owner_id, created_at');
    if (status !== 'all') q2 = q2.eq('status', status);
    if (term) q2 = q2.or(`name.ilike.%${term}%,area.ilike.%${term}%,email.ilike.%${term}%`);
    return q2;
  };

  const { count: filteredTotal, error: countError } = await countQuery();
  const total = filteredTotal ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: orgs, error: listError } = await dataQuery()
    .order('created_at', { ascending: false })
    .range(from, to);
  const rows = orgs ?? [];

  const ownerIds = [...new Set(rows.map((o) => o.owner_id).filter(Boolean))];
  const orgIds = rows.map((o) => o.id);
  const [{ data: owners }, { data: memberCounts }, { data: projectCounts }] = await Promise.all([
    ownerIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', ownerIds)
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? supabase.from('organization_members').select('organization_id').in('organization_id', orgIds)
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? supabase.from('projects').select('organization_id').in('organization_id', orgIds)
      : Promise.resolve({ data: [] }),
  ]);

  const ownerMap = Object.fromEntries((owners ?? []).map((o) => [o.id, o.full_name]));
  const membersByOrg: Record<string, number> = {};
  for (const m of memberCounts ?? []) {
    membersByOrg[m.organization_id] = (membersByOrg[m.organization_id] ?? 0) + 1;
  }
  const projectsByOrg: Record<string, number> = {};
  for (const p of projectCounts ?? []) {
    projectsByOrg[p.organization_id] = (projectsByOrg[p.organization_id] ?? 0) + 1;
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Business</div>
        <h1>Organizations</h1>
        <p className="page-header-sub">Business and agency accounts, members, and projects.</p>
      </div>

      <ErrorBanner errors={[countError?.message, listError?.message]} />

      <div className="toolbar">
        <nav className="tabs m-0">
          {statuses.map((s) => (
            <Link
              key={s}
              className={s === status ? 'selected' : ''}
              href={`/organizations?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            >
              {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </nav>
        <form>
          <input type="hidden" name="status" value={status} />
          <input type="text" name="q" defaultValue={q ?? ''} placeholder="Search organizations..." className="search-input" style={{ width: 240 }} />
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Owner</th>
              <th>Area</th>
              <th>Members</th>
              <th>Projects</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  No organizations yet.
                </td>
              </tr>
            ) : (
              rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/organizations/${o.id}`}>{o.name}</Link>
                    <div className="mono" style={{ opacity: 0.7, marginTop: 2 }}>
                      {o.email || o.phone || '—'}
                    </div>
                  </td>
                  <td>
                    {ownerMap[o.owner_id] ? (
                      <Link href={`/customers/${o.owner_id}`}>{ownerMap[o.owner_id]}</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{o.area || '—'}</td>
                  <td>{membersByOrg[o.id] ?? 0}</td>
                  <td>{projectsByOrg[o.id] ?? 0}</td>
                  <td>
                    <span className={`pill ${o.status === 'active' ? 'approved' : o.status === 'suspended' ? 'rejected' : 'pending'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td>{stamp(o.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/organizations" params={{ status, ...(q ? { q } : {}) }} />
    </>
  );
}
