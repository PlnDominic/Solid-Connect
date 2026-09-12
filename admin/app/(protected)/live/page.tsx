import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatDistanceKm, formatRelativeTime, haversineKm, mapsUrl } from '../../../lib/geo';
import { AutoRefresh } from './AutoRefresh';

export const dynamic = 'force-dynamic';

const ACTIVE_JOB_STATUSES = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];
const statusLabels: Record<string, string> = {
  accepted: 'Accepted',
  in_progress: 'In Progress',
  awaiting_completion_confirmation: 'Awaiting Confirmation',
};

function PartyCell({
  name,
  initials,
  lat,
  lng,
  updatedAt,
  accentBg,
  accentFg,
}: {
  name: string;
  initials: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  updatedAt: string | null | undefined;
  accentBg: string;
  accentFg: string;
}) {
  const sharing = lat != null && lng != null;
  return (
    <div>
      <div className="profile-cell">
        <div className="profile-avatar" style={{ background: accentBg, color: accentFg, width: 28, height: 28, fontSize: 10 }}>
          {initials}
        </div>
        <span>{name}</span>
      </div>
      {sharing ? (
        <div style={{ marginTop: 4, fontSize: 11.5 }}>
          <a href={mapsUrl(lat!, lng!)} target="_blank" rel="noreferrer" className="mono" style={{ color: 'var(--accent-text)' }}>
            Open in Maps
          </a>
          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {formatRelativeTime(updatedAt!)}</span>
        </div>
      ) : (
        <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-muted)' }}>Not sharing yet</div>
      )}
    </div>
  );
}

export default async function LiveJobsPage() {
  const supabase = await createServerSupabase();

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, title, price, location_label, status, customer_id, provider_id')
    .in('status', ACTIVE_JOB_STATUSES)
    .order('started_at', { ascending: false });

  const jobList = jobs ?? [];
  const jobIds = jobList.map((j) => j.id);

  const [{ data: locations, error: locError }, { data: profiles, error: profilesError }] = await Promise.all([
    jobIds.length > 0
      ? supabase.from('job_locations').select('*').in('job_id', jobIds)
      : Promise.resolve({ data: [], error: null }),
    (() => {
      const peopleIds = [...new Set(jobList.flatMap((j) => [j.customer_id, j.provider_id]).filter(Boolean))];
      return peopleIds.length > 0
        ? supabase.from('profiles').select('id, full_name, initials').in('id', peopleIds)
        : Promise.resolve({ data: [], error: null });
    })(),
  ]);

  const errors = [jobsError?.message, locError?.message, profilesError?.message];

  const locationByJob: Record<string, any> = {};
  (locations ?? []).forEach((l: any) => { locationByJob[l.job_id] = l; });
  const profileById: Record<string, any> = {};
  (profiles ?? []).forEach((p: any) => { profileById[p.id] = p; });

  const bothSharing = jobList.filter((j) => {
    const loc = locationByJob[j.id];
    return loc?.provider_lat != null && loc?.customer_lat != null;
  }).length;
  const noneSharing = jobList.filter((j) => {
    const loc = locationByJob[j.id];
    return loc?.provider_lat == null && loc?.customer_lat == null;
  }).length;

  return (
    <>
      <AutoRefresh />
      <div className="page-header">
        <div className="page-header-eyebrow">Operations</div>
        <h1>Live Jobs</h1>
        <p className="page-header-sub">
          Real-time position of both parties on every active job - refreshes automatically every 15 seconds.
        </p>
      </div>

      <ErrorBanner errors={errors} />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-label">Active Jobs</div>
          <div className="stat-card-value">{jobList.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Both Parties Sharing</div>
          <div className="stat-card-value" style={{ color: 'var(--green)' }}>{bothSharing}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Neither Sharing</div>
          <div className="stat-card-value" style={{ color: jobList.length && noneSharing ? 'var(--red)' : undefined }}>{noneSharing}</div>
        </div>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Provider</th>
              <th>Customer</th>
              <th>Apart</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {jobList.length > 0 ? jobList.map((j) => {
              const loc = locationByJob[j.id];
              const provider = profileById[j.provider_id];
              const customer = profileById[j.customer_id];
              const hasBoth = loc?.provider_lat != null && loc?.customer_lat != null;
              const distanceKm = hasBoth
                ? haversineKm({ lat: loc!.provider_lat!, lng: loc!.provider_lng! }, { lat: loc!.customer_lat!, lng: loc!.customer_lng! })
                : null;
              return (
                <tr key={j.id}>
                  <td>
                    <Link href={`/jobs/${j.id}`} style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{j.title || 'Untitled'}</Link>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 2 }}>{j.location_label ?? '—'}</div>
                  </td>
                  <td>
                    <PartyCell
                      name={provider?.full_name ?? '—'}
                      initials={provider?.initials ?? '?'}
                      lat={loc?.provider_lat}
                      lng={loc?.provider_lng}
                      updatedAt={loc?.provider_updated_at}
                      accentBg="var(--accent-bg)"
                      accentFg="var(--accent-text)"
                    />
                  </td>
                  <td>
                    <PartyCell
                      name={customer?.full_name ?? '—'}
                      initials={customer?.initials ?? '?'}
                      lat={loc?.customer_lat}
                      lng={loc?.customer_lng}
                      updatedAt={loc?.customer_updated_at}
                      accentBg="var(--blue-bg)"
                      accentFg="var(--blue)"
                    />
                  </td>
                  <td style={{ fontWeight: 700 }}>{distanceKm != null ? formatDistanceKm(distanceKm) : '—'}</td>
                  <td>
                    <span className="pill pending">{statusLabels[j.status] ?? j.status}</span>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="empty">No active jobs right now.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
