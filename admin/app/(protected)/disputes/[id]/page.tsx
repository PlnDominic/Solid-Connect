import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '../../../../lib/supabase';
import { getJobActivity } from '../../../../lib/jobActivity';
import { JobActivity } from '../../../components/JobActivity';
import { resolveDispute } from '../actions';

const reasonLabel: Record<string, string> = {
  not_completed: 'Not completed',
  poor_quality: 'Poor quality',
  overcharged: 'Overcharged',
  no_show: 'No-show',
  other: 'Other',
};

const stamp = (date: string | null) =>
  date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(date)) : '—';

export default async function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: dispute } = await supabase
    .from('disputes')
    .select('id, job_id, customer_id, provider_id, reason, description, status, resolution_note, resolved_at, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!dispute) notFound();

  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, price, location_label, status, request_id, started_at, completed_at')
    .eq('id', dispute.job_id)
    .maybeSingle();

  const [{ data: customer }, { data: provider }, { data: request }, activity] = await Promise.all([
    supabase.from('profiles').select('full_name, phone').eq('id', dispute.customer_id).maybeSingle(),
    supabase.from('profiles').select('full_name, phone').eq('id', dispute.provider_id).maybeSingle(),
    job?.request_id
      ? supabase.from('service_requests').select('photos').eq('id', job.request_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getJobActivity(supabase, dispute.job_id),
  ]);

  const photos = request?.photos ?? [];
  const resolve = resolveDispute.bind(null, dispute.id);

  return (
    <>
      <Link className="mono" href="/disputes">← Back to disputes</Link>

      <div className="topline" style={{ marginTop: 20 }}>
        <div>
          <p className="eyebrow">Dispute</p>
          <h1 className="heading">{reasonLabel[dispute.reason] ?? dispute.reason}</h1>
          <p className="intro">
            {job?.title ?? 'Job'} · Filed {new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(dispute.created_at))}
          </p>
        </div>
        <span className={`pill ${dispute.status === 'resolved' ? 'approved' : 'pending'}`}>{dispute.status}</span>
      </div>

      <div className="detail">
        <section className="panel">
          <h2>Complaint</h2>
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
              <label>Job price</label>
              <strong>${job?.price?.toLocaleString('en-US') ?? '—'}</strong>
            </div>
            <div>
              <label>Location</label>
              <strong>{job?.location_label ?? '—'}</strong>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.5 }}>{dispute.description || 'No description provided.'}</p>

          <h2 style={{ marginTop: 28 }}>Evidence — request photos</h2>
          <div className="docs">
            {photos.length > 0 ? photos.map((url: string) => (
              <a className="doc" key={url} href={url} target="_blank" rel="noreferrer" style={{ padding: 0, overflow: 'hidden' }}>
                <img src={url} alt="Request evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>
            )) : <div className="doc">No photos were attached to the original request.</div>}
          </div>

          <div style={{ marginTop: 28 }}>
            <JobActivity events={activity.events} messages={activity.messages} actorMap={activity.actorMap} />
          </div>
        </section>

        <aside className="panel">
          <h2>Decision</h2>
          {dispute.status === 'open' ? (
            <form action={resolve} className="actions">
              <textarea className="field" name="note" required placeholder="Explain the outcome for both sides." />
              <button className="btn approve" type="submit">Resolve dispute</button>
            </form>
          ) : (
            <>
              <p style={{ fontSize: 13 }}>
                Resolved {stamp(dispute.resolved_at)}
              </p>
              {dispute.resolution_note && (
                <>
                  <label>Resolution note</label>
                  <p style={{ fontSize: 13.5, marginTop: 4 }}>{dispute.resolution_note}</p>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
