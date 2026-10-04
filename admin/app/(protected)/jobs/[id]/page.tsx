import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '../../../../lib/supabase';
import { phonesFor } from '../../../../lib/phones';
import { getJobActivity } from '../../../../lib/jobActivity';
import { formatDistanceKm, formatRelativeTime, haversineKm, mapsUrl } from '../../../../lib/geo';
import { JobActivity } from '../../../components/JobActivity';

const ACTIVE_STATUSES = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];
const currency = (n: number) => `GH₵${(n ?? 0).toLocaleString('en-US')}`;
const stamp = (date: string | null) =>
  date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(date)) : '-';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, price, location_label, status, customer_id, provider_id, started_at, completed_at, scheduled_for, cancel_reason, cancel_note, cancelled_at')
    .eq('id', id)
    .maybeSingle();
  if (!job) notFound();

  const [{ data: customer }, { data: provider }, { data: location }, activity] = await Promise.all([
    supabase.from('profiles').select('full_name, initials, area').eq('id', job.customer_id).maybeSingle(),
    supabase.from('profiles').select('full_name, initials').eq('id', job.provider_id).maybeSingle(),
    supabase.from('job_locations').select('*').eq('job_id', job.id).maybeSingle(),
    getJobActivity(supabase, job.id),
  ]);
  const phones = await phonesFor(supabase, [job.customer_id, job.provider_id]);

  const isActive = ACTIVE_STATUSES.includes(job.status);
  const hasBoth = location?.provider_lat != null && location?.customer_lat != null;
  const distanceKm = hasBoth
    ? haversineKm({ lat: location!.provider_lat!, lng: location!.provider_lng! }, { lat: location!.customer_lat!, lng: location!.customer_lng! })
    : null;

  return (
    <>
      <Link className="mono" href="/jobs">← Back to jobs</Link>

      <div className="topline mt-20" >
        <div>
          <p className="eyebrow">Job</p>
          <h1 className="heading">{job.title || 'Untitled job'}</h1>
          <p className="intro">{job.location_label ?? 'No location on file'} · {currency(job.price)}</p>
        </div>
        <span className={`pill ${job.status === 'completed' ? 'approved' : job.status === 'cancelled' ? 'rejected' : 'pending'}`}>
          {job.status.replaceAll('_', ' ')}
        </span>
      </div>

      {job.scheduled_for ? (
        <p className="text-muted-md">Scheduled for {new Date(job.scheduled_for).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      ) : null}
      {job.status === 'cancelled' ? (
        <p className="notice">
          Cancelled ({job.cancel_reason?.replaceAll('_', ' ') ?? 'no reason'}){job.cancel_note ? `: ${job.cancel_note}` : ''}.
          {job.cancel_reason === 'no_show_customer' ? ' Payment was left pending for an admin decision.' : ''}
        </p>
      ) : null}

      <div className="detail">
        <section className="panel">
          <h2>Job details</h2>
          <div className="facts">
            <div>
              <label>Customer</label>
              <strong>{customer?.full_name ?? '-'}</strong>
            </div>
            <div>
              <label>Provider</label>
              <strong>{provider?.full_name ?? '-'}</strong>
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

          <div className="mt-28">
            <JobActivity events={activity.events} messages={activity.messages} actorMap={activity.actorMap} />
          </div>
        </section>

        <aside className="panel">
          <h2>Live location</h2>
          {!isActive ? (
            <p className="text-muted-md">This job isn't currently active.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label>Provider</label>
                {location?.provider_lat != null ? (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)' }}>
                    <a href={mapsUrl(location.provider_lat, location.provider_lng!)} target="_blank" rel="noreferrer" className="text-accent">
                      Open in Maps
                    </a>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {formatRelativeTime(location.provider_updated_at!)}</span>
                  </p>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Not sharing yet</p>
                )}
              </div>
              <div>
                <label>Customer</label>
                {location?.customer_lat != null ? (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)' }}>
                    <a href={mapsUrl(location.customer_lat, location.customer_lng!)} target="_blank" rel="noreferrer" className="text-accent">
                      Open in Maps
                    </a>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {formatRelativeTime(location.customer_updated_at!)}</span>
                  </p>
                ) : (
                  <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Not sharing yet</p>
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

          <h2 className="mt-28">Contact</h2>
          <div className="facts" style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <label>Customer phone</label>
              <strong>{phones[job.customer_id] ?? 'Not provided'}</strong>
            </div>
            <div>
              <label>Provider phone</label>
              <strong>{phones[job.provider_id] ?? 'Not provided'}</strong>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
