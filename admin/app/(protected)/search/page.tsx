import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';

type Props = { searchParams: Promise<{ q?: string }> };

/** Strips characters that would break a PostgREST .or()/.ilike() filter string. */
const sanitizeForFilter = (s: string) => s.replace(/[,()%_]/g, ' ').trim();
const currency = (n: number) => `GH₵${(n ?? 0).toLocaleString('en-US')}`;

export default async function SearchPage({ searchParams }: Props) {
  const { q: raw } = await searchParams;
  const q = raw ? sanitizeForFilter(raw) : '';
  const supabase = await createServerSupabase();

  const [{ data: customers, error: customersError }, { data: providers, error: providersError }, { data: jobs, error: jobsError }] = q
    ? await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, initials, email, area')
          .eq('role', 'customer')
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(10),
        supabase
          .from('profiles')
          .select('id, full_name, initials, email, provider_category, area')
          .eq('role', 'provider')
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,provider_category.ilike.%${q}%`)
          .limit(10),
        supabase
          .from('jobs')
          .select('id, title, price, location_label, status')
          .or(`title.ilike.%${q}%,location_label.ilike.%${q}%`)
          .limit(10),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  const errors = [customersError?.message, providersError?.message, jobsError?.message];
  const noResults = q && (customers ?? []).length === 0 && (providers ?? []).length === 0 && (jobs ?? []).length === 0;

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Search</div>
        <h1>{q ? `Results for "${q}"` : 'Search'}</h1>
        <p className="page-header-sub">Across customers, providers, and jobs.</p>
      </div>

      <ErrorBanner errors={errors} />

      {!q ? (
        <div className="empty">Type something in the search bar above.</div>
      ) : noResults ? (
        <div className="empty">No matches for &quot;{q}&quot;.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(customers ?? []).length > 0 && (
            <div className="table-card">
              <div className="table-card-header"><h3>Customers</h3></div>
              <table className="table">
                <tbody>
                  {(customers ?? []).map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="profile-cell">
                          <div className="profile-avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>{c.initials}</div>
                          <div>
                            <Link href={`/customers/${c.id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{c.full_name}</Link>
                            <br /><span className="mono">{c.email ?? 'No email'}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{c.area}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(providers ?? []).length > 0 && (
            <div className="table-card">
              <div className="table-card-header"><h3>Providers</h3></div>
              <table className="table">
                <tbody>
                  {(providers ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="profile-cell">
                          <div className="profile-avatar" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{p.initials}</div>
                          <div>
                            <Link href={`/providers/${p.id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{p.full_name}</Link>
                            <br /><span className="mono">{p.email ?? 'No email'}</span>
                          </div>
                        </div>
                      </td>
                      <td>{p.provider_category ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.area}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(jobs ?? []).length > 0 && (
            <div className="table-card">
              <div className="table-card-header"><h3>Jobs</h3></div>
              <table className="table">
                <tbody>
                  {(jobs ?? []).map((j) => (
                    <tr key={j.id}>
                      <td><Link href={`/jobs/${j.id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{j.title || 'Untitled'}</Link></td>
                      <td style={{ color: 'var(--text-muted)' }}>{j.location_label}</td>
                      <td style={{ fontWeight: 700 }}>{currency(j.price)}</td>
                      <td><span className={`pill ${j.status === 'completed' ? 'approved' : 'pending'}`}>{j.status.replaceAll('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
