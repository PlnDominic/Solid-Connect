import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '../../../../lib/supabase';
import { getJobActivity } from '../../../../lib/jobActivity';
import { formatDistanceKm, formatRelativeTime, haversineKm, mapsUrl } from '../../../../lib/geo';
import { JobActivity } from '../../../components/JobActivity';

const ACTIVE_STATUSES = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];
const currency = (n: number) => `GH₵${(n ?? 0).toLocaleString('en-US')}`;
const stamp = (date: string | null) =>
  date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(date)) : '—';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, price, location_label, status, customer_id, provider_id, started_at, completed_at')
    .eq('id', id)
    .maybeSingle();
  if (!job) notFound();

  const [{ data: customer }, { data: provider }, { data: location }, activity] = await Promise.all([
    supabase.from('profiles').select('full_name, initials, phone, email, area').eq('id', job.customer_id).maybeSingle(),
    supabase.from('profiles').select('full_name, initials, phone, email').eq('id', job.provider_id).maybeSingle(),
    supabase.from('job_locations').select('*').eq('job_id', job.id).maybeSingle(),
    getJobActivity(supabase, job.id),
  ]);

  const isActive = ACTIVE_STATUSES.includes(job.status);
  const hasBoth = location?.provider_lat != null && location?.customer_lat != null;
  const distanceKm = hasBoth
    ? haversineKm({ lat: location!.provider_lat!, lng: location!.provider_lng! }, { lat: location!.customer_lat!, lng: location!.customer_lng! })
    : null;

  return (
    <>
      <Link className="mono" href="/jobs">← Back to jobs</Link>

      <div className="topline" style={{ marginTop: 20 }}>
        <div>
          <p className="eyebrow">Job</p>
          <h1 className="heading">{job.title || 'Untitled job'}</h1>
          <p className="intro">{job.location_label ?? 'No location on file'} · {currency(job.price)}</p>
        </div>
        <span className={`pill ${job.status === 'completed' ? 'approved' : 'pending'}`}>
          {job.status.replaceAll('_', ' ')}
        </span>
      </div>

      <div className="detail">
        <section className="panel">
          <h2>Job details</h2>
          <div className="facts">
            <div>
              <label>Customer</label>
              <strong>{customer?.full_name ?? '—'}</strong>
            </div>
            <div>
              <label>Provider</label>
              <strong>{provider?.full_name ?? '—'}</strong>
            </div>
            <div>
              <label>Started</label>
              <strong>{stamp(job.started_at)}</strong>
            </div>
            <div>
              <label>Completed</label>
              <strong>{stamp(job.completed_at)}</strong>
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <JobActivity events={activity.events} messages={activity.messages} actorMap={activity.actorMap} />
          </div>
        </section>

        <aside className="panel">
          <h2>Live location</h2>
          {!isActive ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>This job isn't currently active.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label>Provider</label>
                {location?.provider_lat != null ? (
                  <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                    <a href={mapsUrl(location.provider_lat, location.provider_lng!)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>
                      Open in Maps
                    </a>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {formatRelativeTime(location.provider_updated_at!)}</span>
                  </p>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Not sharing yet</p>
                )}
              </div>
              <div>
                <label>Customer</label>
                {location?.customer_lat != null ? (
                  <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                    <a href={mapsUrl(location.customer_lat, location.customer_lng!)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>
                      Open in Maps
                    </a>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {formatRelativeTime(location.customer_updated_at!)}</span>
                  </p>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Not sharing yet</p>
                )}
              </div>
              {distanceKm != null && (
                <div>
                  <label>Apart</label>
                  <strong>{formatDistanceKm(distanceKm)}</strong>
                </div>
              )}
            </div>
          )}

          <h2 style={{ marginTop: 28 }}>Contact</h2>
          <div className="facts" style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <label>Customer phone</label>
              <strong>{customer?.phone ?? 'Not provided'}</strong>
            </div>
            <div>
              <label>Provider phone</label>
              <strong>{provider?.phone ?? 'Not provided'}</strong>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
