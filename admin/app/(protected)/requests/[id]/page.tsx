import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '../../../../lib/supabase';

const stamp = (date: string | null | undefined) =>
  date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '—';
const currency = (n: number | null | undefined) => (n == null ? '—' : `GH₵${n.toLocaleString('en-US')}`);

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: request } = await supabase
    .from('service_requests')
    .select(
      'id, customer_id, category_label, description, photos, location_label, status, request_mode, customer_budget, budget_min, budget_max, preferred_provider_id, rejection_reason, matched_at, match_radius_meters, created_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (!request) notFound();

  const [{ data: customer }, { data: preferred }, { data: quotes }, { data: opportunities }, { data: job }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, email, area').eq('id', request.customer_id).maybeSingle(),
    request.preferred_provider_id
      ? supabase.from('profiles').select('id, full_name').eq('id', request.preferred_provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('quotes')
      .select('id, provider_id, price, eta_label, status, created_at, note')
      .eq('request_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('request_opportunities')
      .select('id, provider_id, score, status, distance_meters, created_at')
      .eq('request_id', id)
      .order('score', { ascending: false })
      .limit(40),
    supabase.from('jobs').select('id, title, status, price').eq('request_id', id).maybeSingle(),
  ]);

  const providerIds = [
    ...new Set([
      ...(quotes ?? []).map((q) => q.provider_id),
      ...(opportunities ?? []).map((o) => o.provider_id),
    ].filter(Boolean)),
  ];
  const { data: providers } = providerIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', providerIds)
    : { data: [] };
  const providerMap = Object.fromEntries((providers ?? []).map((p) => [p.id, p.full_name]));

  const budget = request.customer_budget ?? request.budget_max ?? request.budget_min;
  const photos = (request.photos ?? []) as string[];

  return (
    <>
      <Link className="mono" href="/requests">
        ← Back to requests
      </Link>

      <div className="topline mt-20">
        <div>
          <p className="eyebrow">Service request</p>
          <h1 className="heading">{request.category_label || 'Request'}</h1>
          <p className="intro">
            {request.location_label || 'No location'} · {request.request_mode === 'DIRECT' ? 'Direct hire' : 'Open market'}
          </p>
        </div>
        <span className={`pill ${request.status === 'cancelled' || request.status === 'rejected' ? 'rejected' : request.status === 'accepted' || request.status === 'completed' ? 'approved' : 'pending'}`}>
          {request.status.replaceAll('_', ' ')}
        </span>
      </div>

      <div className="detail">
        <section className="panel">
          <h2>Details</h2>
          <div className="facts">
            <div>
              <label>Customer</label>
              <strong>
                {customer ? <Link href={`/customers/${customer.id}`}>{customer.full_name}</Link> : '—'}
              </strong>
            </div>
            <div>
              <label>Budget</label>
              <strong>{currency(budget)}</strong>
            </div>
            <div>
              <label>Created</label>
              <strong>{stamp(request.created_at)}</strong>
            </div>
            <div>
              <label>Matched</label>
              <strong>{stamp(request.matched_at)}</strong>
            </div>
            <div>
              <label>Match radius</label>
              <strong>
                {request.match_radius_meters != null ? `${Math.round(request.match_radius_meters / 1000)} km` : '—'}
              </strong>
            </div>
            <div>
              <label>Preferred provider</label>
              <strong>
                {preferred ? <Link href={`/providers/${preferred.id}`}>{preferred.full_name}</Link> : '—'}
              </strong>
            </div>
          </div>

          <h2 className="mt-28">Description</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{request.description || 'No description.'}</p>
          {request.rejection_reason ? (
            <p className="notice">Decline reason: {request.rejection_reason}</p>
          ) : null}

          {job ? (
            <>
              <h2 className="mt-28">Job</h2>
              <p>
                <Link href={`/jobs/${job.id}`}>{job.title || 'Open job'}</Link> · {job.status.replaceAll('_', ' ')} ·{' '}
                {currency(job.price)}
              </p>
            </>
          ) : null}

          <h2 className="mt-28">Photos</h2>
          <div className="docs">
            {photos.length > 0 ? (
              photos.map((url) => (
                <a className="doc" key={url} href={url} target="_blank" rel="noreferrer" style={{ padding: 0, overflow: 'hidden' }}>
                  <img src={url} alt="Request photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </a>
              ))
            ) : (
              <div className="doc">No photos attached.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Quotes ({quotes?.length ?? 0})</h2>
          {(quotes ?? []).length === 0 ? (
            <p className="text-muted-md">No quotes yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Price</th>
                  <th>ETA</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(quotes ?? []).map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link href={`/providers/${q.provider_id}`}>{providerMap[q.provider_id] ?? 'Provider'}</Link>
                    </td>
                    <td>{currency(q.price)}</td>
                    <td>{q.eta_label || '—'}</td>
                    <td>{q.status}</td>
                    <td>{stamp(q.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="mt-28">Matched providers ({opportunities?.length ?? 0})</h2>
          {(opportunities ?? []).length === 0 ? (
            <p className="text-muted-md">No opportunity rows for this request.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Score</th>
                  <th>Distance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(opportunities ?? []).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/providers/${o.provider_id}`}>{providerMap[o.provider_id] ?? 'Provider'}</Link>
                    </td>
                    <td>{o.score != null ? Number(o.score).toFixed(1) : '—'}</td>
                    <td>{o.distance_meters != null ? `${(Number(o.distance_meters) / 1000).toFixed(1)} km` : '—'}</td>
                    <td>{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
