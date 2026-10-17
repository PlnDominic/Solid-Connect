import { redirect } from 'next/navigation';
import { createAdminClient, requireAdmin } from '../../../lib/admin';
import { placeProvider, placeRequest } from '../../../lib/mapPoints';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AutoRefresh } from '../live/AutoRefresh';
import { AdminMap, type MapProvider, type MapRequest } from './AdminMap';

export const dynamic = 'force-dynamic';

// Requests still looking for a provider - the ones the provider map shows.
const OPEN_REQUEST_STATUSES = ['open', 'matching', 'quoted'];

/** "Electrical · Wiring" -> "Wiring", as the app shortens categories on pins. */
function shortCategory(label: string | null | undefined): string | null {
  if (!label) return null;
  return label.split('·').pop()?.trim() || label;
}

export default async function MapPage() {
  // Provider presence has no read policy for anyone (0067) - it's only ever
  // read through security-definer functions - so this page reads with the
  // service role, behind its own admin check, like the Overview page.
  const admin = await requireAdmin();
  if (!admin) redirect('/login');
  const supabase = createAdminClient();

  const [providersRes, presenceRes, areasRes, requestsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, initials, photo_url, provider_category, provider_rating, provider_jobs_count, provider_verified, availability_mode, area, location, suspended_at')
      .eq('role', 'provider')
      .limit(5000),
    supabase.from('provider_presence').select('provider_id, lat, lng, updated_at'),
    supabase.from('provider_service_areas').select('provider_id, city_name, center, created_at').order('created_at', { ascending: true }),
    supabase
      .from('service_requests')
      .select('id, customer_id, category_label, location_label, status, request_mode, customer_budget, budget_min, budget_max, photos, created_at')
      .in('status', OPEN_REQUEST_STATUSES)
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  const presenceById = new Map((presenceRes.data ?? []).map((p) => [p.provider_id as string, p]));
  const firstAreaById = new Map<string, { city_name: string | null; center: unknown }>();
  for (const a of areasRes.data ?? []) if (!firstAreaById.has(a.provider_id)) firstAreaById.set(a.provider_id, a);

  const now = Date.now();
  const providers: MapProvider[] = [];
  let unplacedProviders = 0;
  for (const p of providersRes.data ?? []) {
    const at = placeProvider({ ...p, presence: presenceById.get(p.id) ?? null, serviceArea: firstAreaById.get(p.id) ?? null }, now);
    if (!at) { unplacedProviders++; continue; }
    providers.push({
      id: p.id,
      name: p.full_name || 'Provider',
      initials: p.initials || '?',
      photoUrl: p.photo_url ?? null,
      category: shortCategory(p.provider_category),
      rating: Number(p.provider_rating ?? 0),
      jobs: p.provider_jobs_count ?? 0,
      verified: Boolean(p.provider_verified),
      availability: p.availability_mode ?? null,
      live: at.live,
      lastSeen: presenceById.get(p.id)?.updated_at ?? null,
      suspended: Boolean(p.suspended_at),
      area: at.areaLabel,
      lat: at.lat,
      lng: at.lng,
    });
  }

  const requestRows = requestsRes.data ?? [];
  const customerIds = [...new Set(requestRows.map((r) => r.customer_id).filter(Boolean))];
  const { data: customers } = customerIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', customerIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const customerName = new Map((customers ?? []).map((c) => [c.id, c.full_name]));

  const requests: MapRequest[] = [];
  let unplacedRequests = 0;
  for (const r of requestRows) {
    const at = placeRequest(r);
    if (!at) { unplacedRequests++; continue; }
    requests.push({
      id: r.id,
      title: shortCategory(r.category_label) ?? 'Request',
      category: r.category_label ?? null,
      area: at.areaLabel,
      locationLabel: r.location_label ?? null,
      status: r.status,
      mode: r.request_mode ?? 'GENERAL',
      budget: r.customer_budget ?? r.budget_min ?? null,
      budgetMax: r.customer_budget == null ? r.budget_max ?? null : null,
      photoUrl: Array.isArray(r.photos) && typeof r.photos[0] === 'string' ? r.photos[0] : null,
      createdAt: r.created_at,
      customerName: customerName.get(r.customer_id) ?? null,
      lat: at.lat,
      lng: at.lng,
    });
  }

  const liveCount = providers.filter((p) => p.live).length;

  return (
    <>
      <AutoRefresh intervalMs={30_000} />
      <div className="page-header">
        <div className="page-header-eyebrow">Operations</div>
        <h1>Map</h1>
        <p className="page-header-sub">
          Every provider and open request in one view, placed the way the app places them. Refreshes every 30 seconds.
        </p>
      </div>

      <ErrorBanner errors={[providersRes.error?.message, presenceRes.error?.message, areasRes.error?.message, requestsRes.error?.message]} />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Providers on map</div>
          <div className="stat-card-value">{providers.length}</div>
          <div className="stat-card-sub">{providers.filter((p) => p.suspended).length} suspended</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Available now</div>
          <div className="stat-card-value">{liveCount}</div>
          <div className="stat-card-sub">App open in the last 10 minutes</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Open requests</div>
          <div className="stat-card-value">{requests.length}</div>
          <div className="stat-card-sub">Open, matching or quoted</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Not on map</div>
          <div className="stat-card-value">{unplacedProviders + unplacedRequests}</div>
          <div className="stat-card-sub">{unplacedProviders} providers · {unplacedRequests} requests with no known area</div>
        </div>
      </div>

      <AdminMap providers={providers} requests={requests} />
    </>
  );
}
