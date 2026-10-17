/**
 * Where providers and requests go on the admin map. Mirrors the mobile
 * app's placement (map_providers in 0068, src/lib/areaCoords.ts and
 * src/lib/mapPins.ts) so a pin lands in the same neighbourhood here as it
 * does for customers and providers:
 *   - a live provider ("Available now" with a fix from the last 10 min) sits
 *     on their reported presence point;
 *   - anyone else sits on their area's centre: the neighbourhood named in
 *     profiles.area, else their first service area, else their saved
 *     location;
 *   - requests only know their neighbourhood (location_label).
 * Everyone who shares a centre is spread a little around it, so pins in
 * the same area don't stack into one.
 */

export type LatLng = { lat: number; lng: number };

/** Approximate neighbourhood centres. Mirrors src/lib/areaCoords.ts and
 * public.area_centroids (0012 + 0068) - add a neighbourhood to all three. */
export const AREA_COORDS: Record<string, LatLng> = {
  Achimota: { lng: -0.232, lat: 5.627 },
  'Trasacco Valley': { lng: -0.158, lat: 5.635 },
  'Airport Residential': { lng: -0.177, lat: 5.605 },
  Cantonments: { lng: -0.173, lat: 5.575 },
  Osu: { lng: -0.183, lat: 5.558 },
  Spintex: { lng: -0.098, lat: 5.636 },
  Tema: { lng: -0.017, lat: 5.669 },
  Dansoman: { lng: -0.266, lat: 5.548 },
  Labadi: { lng: -0.15, lat: 5.56 },
  Labone: { lng: -0.17, lat: 5.565 },
  'East Legon': { lng: -0.16, lat: 5.635 },
  Madina: { lng: -0.166, lat: 5.683 },
  Adenta: { lng: -0.168, lat: 5.705 },
  Haatso: { lng: -0.205, lat: 5.666 },
  Dome: { lng: -0.235, lat: 5.65 },
  Kwabenya: { lng: -0.229, lat: 5.68 },
  Dzorwulu: { lng: -0.2, lat: 5.61 },
  'Roman Ridge': { lng: -0.192, lat: 5.602 },
  Tesano: { lng: -0.228, lat: 5.598 },
  Abeka: { lng: -0.234, lat: 5.598 },
  Lapaz: { lng: -0.252, lat: 5.606 },
  Kaneshie: { lng: -0.236, lat: 5.567 },
  Kokomlemle: { lng: -0.208, lat: 5.574 },
  Adabraka: { lng: -0.208, lat: 5.56 },
  Ridge: { lng: -0.197, lat: 5.565 },
  'Accra Central': { lng: -0.205, lat: 5.55 },
  Teshie: { lng: -0.107, lat: 5.583 },
  Nungua: { lng: -0.079, lat: 5.6 },
  Sakumono: { lng: -0.062, lat: 5.618 },
  Ashaiman: { lng: -0.033, lat: 5.694 },
  Weija: { lng: -0.336, lat: 5.556 },
  Kasoa: { lng: -0.425, lat: 5.534 },
};

// Longest first, so "Roman Ridge, Accra" resolves to Roman Ridge, not Ridge.
const NAMES_LONGEST_FIRST = Object.keys(AREA_COORDS).sort((a, b) => b.length - a.length);

/** The known neighbourhood a free-text label names ("Labadi, Accra" -> "Labadi"), or null. */
export function matchAreaName(label: string | null | undefined): string | null {
  const n = (label ?? '').trim().toLowerCase();
  if (n.length < 2) return null;
  return NAMES_LONGEST_FIRST.find((name) => n.includes(name.toLowerCase())) ?? null;
}

export function coordsForLabel(label: string | null | undefined): LatLng | null {
  const area = matchAreaName(label);
  return area ? AREA_COORDS[area] : null;
}

/**
 * A PostGIS point as PostgREST returns it: hex EWKB ("0101000020E6100000..."),
 * or GeoJSON when a column/view is set up that way. Null for anything else.
 */
export function parseGeoPoint(value: unknown): LatLng | null {
  if (!value) return null;
  if (typeof value === 'object') {
    const coords = (value as { type?: string; coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return { lng: coords[0], lat: coords[1] };
    }
    return null;
  }
  if (typeof value !== 'string' || !/^[0-9a-fA-F]+$/.test(value) || value.length < 42) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  const view = new DataView(bytes.buffer);
  const little = view.getUint8(0) === 1;
  const type = view.getUint32(1, little);
  if ((type & 0xff) !== 1) return null; // not a point
  const offset = type & 0x20000000 ? 9 : 5; // skip the SRID when present
  if (bytes.length < offset + 16) return null;
  const lng = view.getFloat64(offset, little);
  const lat = view.getFloat64(offset + 8, little);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// Stable 32-bit FNV-1a hash, so the same id always lands on the same spot.
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A fixed point within `radiusDeg` of a centre (~0.004 deg is ~450 m),
 * picked from the id so a pin doesn't jump between refreshes. Same maths
 * as the app's spreadAroundCentroid. */
export function spreadAroundCentroid(id: string, centroid: LatLng, radiusDeg = 0.004): LatLng {
  const h = hash(id);
  const angle = ((h & 0xffff) / 0x10000) * 2 * Math.PI;
  const r = Math.sqrt(((h >>> 16) & 0xffff) / 0x10000) * radiusDeg;
  return { lat: centroid.lat + r * Math.sin(angle), lng: centroid.lng + r * Math.cos(angle) };
}

/** map_providers' "live" cut-off. */
export const LIVE_MAX_AGE_MS = 10 * 60_000;

export type ProviderPlacementInput = {
  id: string;
  availability_mode: string | null;
  area: string | null;
  location: unknown;
  presence?: { lat: number; lng: number; updated_at: string } | null;
  serviceArea?: { city_name: string | null; center: unknown } | null;
};

export type Placement = LatLng & { live: boolean; areaLabel: string | null };

/** Where a provider goes on the map, or null when nothing places them. */
export function placeProvider(p: ProviderPlacementInput, now = Date.now()): Placement | null {
  const presence = p.presence;
  if (
    presence &&
    p.availability_mode === 'AVAILABLE_NOW' &&
    now - new Date(presence.updated_at).getTime() <= LIVE_MAX_AGE_MS
  ) {
    return { lat: presence.lat, lng: presence.lng, live: true, areaLabel: matchAreaName(p.area) ?? p.area?.split(',')[0]?.trim() ?? null };
  }
  const areaName = matchAreaName(p.area);
  if (areaName) return { ...spreadAroundCentroid(p.id, AREA_COORDS[areaName]), live: false, areaLabel: areaName };
  const sa = p.serviceArea;
  const saCentre = sa ? (coordsForLabel(sa.city_name) ?? parseGeoPoint(sa.center)) : null;
  if (saCentre) return { ...spreadAroundCentroid(p.id, saCentre), live: false, areaLabel: sa?.city_name ?? null };
  const saved = parseGeoPoint(p.location);
  if (saved) return { ...spreadAroundCentroid(p.id, saved), live: false, areaLabel: p.area?.split(',')[0]?.trim() || null };
  return null;
}

/** Where a request goes on the map, or null when its location names no known area. */
export function placeRequest(r: { id: string; location_label: string | null }): (LatLng & { areaLabel: string }) | null {
  const area = matchAreaName(r.location_label);
  if (!area) return null;
  return { ...spreadAroundCentroid(r.id, AREA_COORDS[area]), areaLabel: area };
}
