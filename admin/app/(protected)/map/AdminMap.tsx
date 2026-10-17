'use client';

import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { formatRelativeTime } from '../../../lib/geo';

export type MapProvider = {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  category: string | null;
  rating: number;
  jobs: number;
  verified: boolean;
  availability: string | null;
  live: boolean;
  lastSeen: string | null;
  suspended: boolean;
  area: string | null;
  lat: number;
  lng: number;
};

export type MapRequest = {
  id: string;
  title: string;
  category: string | null;
  area: string;
  locationLabel: string | null;
  status: string;
  mode: string;
  budget: number | null;
  budgetMax: number | null;
  photoUrl: string | null;
  createdAt: string;
  customerName: string | null;
  lat: number;
  lng: number;
};

type Layer = 'all' | 'providers' | 'requests';
type Selected = { kind: 'provider'; id: string } | { kind: 'request'; id: string } | null;

const ACCRA = { lat: 5.6037, lng: -0.187 };
const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE_NOW: 'Available now',
  SCHEDULE: 'On schedule',
  UNAVAILABLE: 'Unavailable',
  PAUSED: 'Paused',
};
const STATUS_LABEL: Record<string, string> = { open: 'Open', matching: 'Matching', quoted: 'Quoted' };

const ghs = (n: number) => `GH₵${n.toLocaleString('en-US')}`;
function budgetLabel(r: MapRequest): string | null {
  if (r.budget == null) return null;
  return r.budgetMax != null && r.budgetMax !== r.budget ? `${ghs(r.budget)}–${ghs(r.budgetMax)}` : ghs(r.budget);
}
/** "Kofi Boateng" -> "Kofi B." - keeps pins compact, as in the app. */
function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts.length < 2 ? parts[0] ?? '' : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
/** "AC repair" -> "AR" - stands in for a missing job photo. */
function initialsOf(label: string) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2)).toUpperCase();
}

function span(cls: string, text: string) {
  const s = document.createElement('span');
  if (cls) s.className = cls;
  s.textContent = text;
  return s;
}

/** Round photo (or initials/badge) for a pin. Only https images load; every
 * label is set with textContent, never as HTML. */
function avatar(photoUrl: string | null, fallback: string, extra?: HTMLElement) {
  const av = document.createElement('div');
  av.className = 'av';
  const showFallback = () => { av.textContent = fallback; if (extra) av.appendChild(extra); };
  if (photoUrl && /^https:\/\//.test(photoUrl)) {
    const img = document.createElement('img');
    img.alt = '';
    img.onerror = () => { av.removeChild(img); showFallback(); };
    img.src = photoUrl;
    av.appendChild(img);
    if (extra) av.appendChild(extra);
  } else {
    showFallback();
  }
  return av;
}

function providerPin(p: MapProvider) {
  const el = document.createElement('div');
  el.className = `map-pin pro${p.live ? ' now' : ''}${p.suspended ? ' off' : ''}`;
  el.appendChild(avatar(p.photoUrl, p.initials, p.live ? span('nowdot', '') : undefined));
  const info = document.createElement('div');
  info.className = 'info';
  info.appendChild(span('nm', shortName(p.name)));
  const sk = span('sk', '');
  if (p.category) { sk.appendChild(span('skill', p.category)); sk.appendChild(span('', '·')); }
  sk.appendChild(span('star', '★'));
  sk.appendChild(span('', p.rating.toFixed(1)));
  if (p.verified) sk.appendChild(span('tick', '✓'));
  info.appendChild(sk);
  el.appendChild(info);
  return el;
}

function requestPin(r: MapRequest) {
  const el = document.createElement('div');
  el.className = 'map-pin pro req';
  el.appendChild(avatar(r.photoUrl, initialsOf(r.title)));
  const info = document.createElement('div');
  info.className = 'info';
  info.appendChild(span('nm', r.title));
  info.appendChild(span('sk', [budgetLabel(r), r.status === 'quoted' ? 'Quoted' : formatRelativeTime(r.createdAt)].filter(Boolean).join(' · ')));
  el.appendChild(info);
  return el;
}

/** The admin's central map: providers and open requests together, drawn
 * with the same pin designs as the app's Map tab (src/components/ServiceMap.tsx)
 * on the same free OpenStreetMap tiles. Pins are rebuilt in place on every
 * server refresh, so the admin's pan and zoom are never reset. */
export function AdminMap({ providers, requests }: { providers: MapProvider[]; requests: MapRequest[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const fittedRef = useRef(false);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState<Layer>('all');
  const [liveOnly, setLiveOnly] = useState(false);
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<Selected>(null);

  const categories = useMemo(() => {
    const names = new Set<string>();
    providers.forEach((p) => p.category && names.add(p.category));
    requests.forEach((r) => names.add(r.title));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [providers, requests]);

  const shownProviders = useMemo(
    () => (layer === 'requests' ? [] : providers.filter((p) => (!liveOnly || p.live) && (category === 'all' || p.category === category))),
    [providers, layer, liveOnly, category],
  );
  const shownRequests = useMemo(
    () => (layer === 'providers' ? [] : requests.filter((r) => category === 'all' || r.title === category)),
    [requests, layer, category],
  );

  // Create the map once. Leaflet touches `window`, so it loads client-side.
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true }).setView([ACCRA.lat, ACCRA.lng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.on('click', () => setSelected(null));
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Rebuild pins whenever the data or filters change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerRef.current;
    if (!ready || !L || !map || !group) return;
    group.clearLayers();
    pinEls.current.clear();
    const add = (key: string, el: HTMLElement, lat: number, lng: number, sel: Selected, z: number) => {
      const marker = L.marker([lat, lng], { icon: L.divIcon({ className: '', html: el, iconSize: [0, 0] }), zIndexOffset: z, keyboard: false });
      marker.on('click', (e) => { L.DomEvent.stopPropagation(e); setSelected(sel); });
      marker.addTo(group);
      pinEls.current.set(key, el);
    };
    shownRequests.forEach((r) => add(`request:${r.id}`, requestPin(r), r.lat, r.lng, { kind: 'request', id: r.id }, 0));
    shownProviders.forEach((p) => add(`provider:${p.id}`, providerPin(p), p.lat, p.lng, { kind: 'provider', id: p.id }, p.live ? 400 : 200));

    // Frame everything once, on first load only - refreshes keep the view.
    if (!fittedRef.current) {
      const points = [...shownProviders, ...shownRequests].map((x) => [x.lat, x.lng] as [number, number]);
      if (points.length) map.fitBounds(L.latLngBounds(points).pad(0.15), { maxZoom: 14 });
      fittedRef.current = true;
    }
  }, [ready, shownProviders, shownRequests]);

  // Highlight the selected pin.
  useEffect(() => {
    pinEls.current.forEach((el, key) => el.classList.toggle('sel', !!selected && key === `${selected.kind}:${selected.id}`));
  }, [selected, shownProviders, shownRequests]);

  const selectedProvider = selected?.kind === 'provider' ? providers.find((p) => p.id === selected.id) ?? null : null;
  const selectedRequest = selected?.kind === 'request' ? requests.find((r) => r.id === selected.id) ?? null : null;

  function focus(lat: number, lng: number) {
    mapRef.current?.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
  }

  return (
    <div className="admin-map-card">
      <div className="admin-map-toolbar">
        <div className="flex-wrap-10">
          {(['all', 'providers', 'requests'] as Layer[]).map((l) => (
            <button key={l} type="button" className={`filter-btn${layer === l ? ' active' : ''}`} aria-pressed={layer === l} onClick={() => setLayer(l)}>
              {l === 'all' ? 'Everything' : l === 'providers' ? `Providers (${providers.length})` : `Requests (${requests.length})`}
            </button>
          ))}
          <button
            type="button"
            className={`filter-btn${liveOnly ? ' active' : ''}`}
            aria-pressed={liveOnly}
            onClick={() => setLiveOnly(!liveOnly)}
            title="Only providers who are Available now with the app open"
          >
            <span className="admin-map-dot" aria-hidden="true" /> Available now
          </button>
        </div>
        <select className="input input-sm" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by service">
          <option value="all">All services</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="admin-map-body">
        <div ref={containerRef} className="admin-map" role="region" aria-label="Map of providers and requests" />

        <aside className="admin-map-panel">
          {selectedProvider ? (
            <div className="admin-map-detail">
              <div className="admin-map-who">
                <div className="admin-map-avatar">
                  {selectedProvider.photoUrl && /^https:\/\//.test(selectedProvider.photoUrl)
                    ? <img src={selectedProvider.photoUrl} alt="" width={48} height={48} />
                    : selectedProvider.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3>{selectedProvider.name}</h3>
                  <div className="text-muted-sm">{selectedProvider.category ?? 'Provider'}</div>
                </div>
              </div>
              <div className="flex-wrap-10">
                {selectedProvider.live
                  ? <span className="pill approved">Available now</span>
                  : <span className="pill pending">{AVAILABILITY_LABEL[selectedProvider.availability ?? ''] ?? 'Not live'}</span>}
                {selectedProvider.verified && <span className="pill approved">Verified</span>}
                {selectedProvider.suspended && <span className="pill rejected">Suspended</span>}
              </div>
              <dl className="admin-map-facts">
                <div><dt>Rating</dt><dd>★ {selectedProvider.rating.toFixed(1)}</dd></div>
                <div><dt>Jobs</dt><dd>{selectedProvider.jobs}</dd></div>
                <div><dt>Area</dt><dd>{selectedProvider.area ?? '—'}</dd></div>
                <div><dt>Last seen</dt><dd>{selectedProvider.lastSeen ? formatRelativeTime(selectedProvider.lastSeen) : '—'}</dd></div>
              </dl>
              <p className="text-muted-sm">
                {selectedProvider.live ? 'Shown at their live position, rounded to about 450 m.' : 'Shown near the centre of their area, not an exact spot.'}
              </p>
              <div className="flex-wrap-10">
                <Link href={`/providers/${selectedProvider.id}`} className="btn">Open provider</Link>
                <button type="button" className="btn outline" onClick={() => focus(selectedProvider.lat, selectedProvider.lng)}>Zoom here</button>
              </div>
            </div>
          ) : selectedRequest ? (
            <div className="admin-map-detail">
              {selectedRequest.photoUrl && /^https:\/\//.test(selectedRequest.photoUrl) && (
                <img src={selectedRequest.photoUrl} alt="" className="admin-map-photo" />
              )}
              <div>
                <h3>{selectedRequest.title}</h3>
                <div className="text-muted-sm">{selectedRequest.locationLabel ?? selectedRequest.area}</div>
              </div>
              <div className="flex-wrap-10">
                <span className={`pill ${selectedRequest.status === 'quoted' ? 'approved' : 'pending'}`}>{STATUS_LABEL[selectedRequest.status] ?? selectedRequest.status}</span>
                {selectedRequest.mode !== 'GENERAL' && <span className="pill pending">Direct to a provider</span>}
              </div>
              <dl className="admin-map-facts">
                <div><dt>Budget</dt><dd>{budgetLabel(selectedRequest) ?? '—'}</dd></div>
                <div><dt>Posted</dt><dd>{formatRelativeTime(selectedRequest.createdAt)}</dd></div>
                <div><dt>Customer</dt><dd>{selectedRequest.customerName ?? '—'}</dd></div>
                <div><dt>Area</dt><dd>{selectedRequest.area}</dd></div>
              </dl>
              <div className="flex-wrap-10">
                <Link href={`/requests/${selectedRequest.id}`} className="btn">Open request</Link>
                <button type="button" className="btn outline" onClick={() => focus(selectedRequest.lat, selectedRequest.lng)}>Zoom here</button>
              </div>
            </div>
          ) : (
            <div className="admin-map-detail">
              <h3>On the map</h3>
              <p className="text-muted-sm">
                Showing {shownProviders.length} {shownProviders.length === 1 ? 'provider' : 'providers'} and {shownRequests.length} open {shownRequests.length === 1 ? 'request' : 'requests'}. Click a pin for details.
              </p>
              <ul className="admin-map-legend">
                <li><span className="map-pin-key pro now" aria-hidden="true" />Provider, available now</li>
                <li><span className="map-pin-key pro" aria-hidden="true" />Provider, not live</li>
                <li><span className="map-pin-key pro off" aria-hidden="true" />Suspended provider</li>
                <li><span className="map-pin-key req" aria-hidden="true" />Open request</li>
              </ul>
              <p className="text-muted-sm">
                Providers who aren&apos;t live, and every request, sit near the centre of their neighbourhood, as in the app.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
