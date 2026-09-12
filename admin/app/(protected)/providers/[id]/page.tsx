import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '../../../../lib/supabase';

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const currency = (n: number) => `$${(n ?? 0).toLocaleString('en-US')}`;

const VERIFICATION_LEVEL_LABEL: Record<string, string> = {
  REGISTERED: 'Registered',
  IDENTITY_VERIFIED: 'Identity verified',
  PROFESSION_VERIFIED: 'Profession verified',
  EXPERIENCE_VERIFIED: 'Experience verified',
  SOLID_CONNECT_VERIFIED: 'Solid Connect verified',
};

export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: provider } = await supabase
    .from('profiles')
    .select('id, full_name, initials, area, phone, email, provider_category, provider_rating, provider_jobs_count, provider_verified, provider_certified, verification_level, availability_mode, created_at, tagline')
    .eq('id', id)
    .eq('role', 'provider')
    .maybeSingle();
  if (!provider) notFound();

  const [
    { data: categoryLinks },
    { data: portfolio },
    { data: verifications },
    { data: jobs },
    { data: reviews },
  ] = await Promise.all([
    supabase.from('provider_categories').select('is_primary, categories(name)').eq('provider_id', id),
    supabase.from('provider_portfolio_photos').select('id, photo_url').eq('provider_id', id).order('created_at', { ascending: false }),
    supabase.from('provider_verifications').select('id, status, verification_type, submitted_at').eq('provider_id', id).order('submitted_at', { ascending: false }),
    supabase.from('jobs').select('id, title, price, status, started_at').eq('provider_id', id).order('started_at', { ascending: false }).limit(25),
    supabase.from('reviews').select('rating, comment, created_at, job_id').eq('provider_id', id).order('created_at', { ascending: false }).limit(25),
  ]);

  const categories = (categoryLinks ?? []).map((c: any) => ({
    name: Array.isArray(c.categories) ? c.categories[0]?.name : c.categories?.name,
    isPrimary: c.is_primary,
  })).filter((c) => c.name);

  return (
    <>
      <Link className="mono" href="/providers">← Back to providers</Link>

      <div className="topline" style={{ marginTop: 20 }}>
        <div>
          <p className="eyebrow">Provider</p>
          <h1 className="heading">{provider.full_name}</h1>
          <p className="intro">{provider.tagline || provider.provider_category || 'No trade set'} · {provider.area}</p>
        </div>
        <span className={`pill ${provider.provider_verified ? 'approved' : 'pending'}`}>
          {VERIFICATION_LEVEL_LABEL[provider.verification_level ?? 'REGISTERED'] ?? provider.verification_level}
        </span>
      </div>

      <div className="detail">
        <section className="panel">
          <h2>Profile</h2>
          <div className="facts">
            <div><label>Phone</label><strong>{provider.phone ?? 'Not provided'}</strong></div>
            <div><label>Email</label><strong>{provider.email ?? 'Not provided'}</strong></div>
            <div><label>Rating</label><strong>{provider.provider_rating?.toFixed?.(1) ?? '—'} · {provider.provider_jobs_count ?? 0} jobs</strong></div>
            <div><label>Availability</label><strong>{provider.availability_mode ?? 'Not set'}</strong></div>
            <div><label>Joined</label><strong>{stamp(provider.created_at)}</strong></div>
            <div><label>Certified</label><strong>{provider.provider_certified ? 'Yes' : 'No'}</strong></div>
          </div>

          {categories.length > 0 && (
            <>
              <h2 style={{ marginTop: 28 }}>Categories offered</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {categories.map((c, i) => (
                  <span key={i} className={`pill ${c.isPrimary ? 'approved' : 'pending'}`}>{c.name}{c.isPrimary ? ' · primary' : ''}</span>
                ))}
              </div>
            </>
          )}

          <h2 style={{ marginTop: 28 }}>Portfolio</h2>
          {(portfolio ?? []).length > 0 ? (
            <div className="docs">
              {(portfolio ?? []).map((p) => (
                <a className="doc" key={p.id} href={p.photo_url} target="_blank" rel="noreferrer" style={{ padding: 0, overflow: 'hidden' }}>
                  <img src={p.photo_url} alt="Portfolio work" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </a>
              ))}
            </div>
          ) : (
            <div className="empty">No portfolio photos uploaded.</div>
          )}
        </section>

        <aside className="panel">
          <h2>Verification history</h2>
          {(verifications ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(verifications ?? []).map((v) => (
                <Link key={v.id} href={`/verifications/${v.id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{v.verification_type ?? 'IDENTITY'}</span>
                  <span className={`pill ${v.status}`}>{v.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No submissions yet.</p>
          )}

          <h2 style={{ marginTop: 28 }}>Recent jobs</h2>
          {(jobs ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(jobs ?? []).map((j) => (
                <Link key={j.id} href={`/jobs/${j.id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{j.title || 'Untitled'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{currency(j.price)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No jobs yet.</p>
          )}

          <h2 style={{ marginTop: 28 }}>Reviews received</h2>
          {(reviews ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(reviews ?? []).map((r, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  <strong>{r.rating}★</strong>{r.comment ? ` — ${r.comment}` : ''}
                  <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>{stamp(r.created_at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No reviews yet.</p>
          )}
        </aside>
      </div>
    </>
  );
}
