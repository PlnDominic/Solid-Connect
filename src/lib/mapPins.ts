import type { JobStatus } from '../types/database';

export type LatLng = { lat: number; lng: number };

export type MapBounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

/** Statuses during which a job's two parties share their live position
 * (mirrors report_job_location's own guard in 0024). */
export const LIVE_JOB_STATUSES: readonly JobStatus[] = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];

export function isLiveJobStatus(status: JobStatus | null | undefined): boolean {
  return !!status && LIVE_JOB_STATUSES.includes(status);
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

/** Requests only know their neighbourhood, so every request in Osu would
 * sit on Osu's one centroid and hide the others. Spreads each one to a
 * fixed point within `radiusDeg` of the centroid (~0.004 deg is ~450 m),
 * picked from its id so a pin doesn't jump around between refreshes. */
export function spreadAroundCentroid(id: string, centroid: LatLng, radiusDeg = 0.004): LatLng {
  const h = hash(id);
  const angle = ((h & 0xffff) / 0x10000) * 2 * Math.PI;
  // sqrt keeps the spread even across the disc instead of bunched at the centre.
  const r = Math.sqrt(((h >>> 16) & 0xffff) / 0x10000) * radiusDeg;
  return { lat: centroid.lat + r * Math.sin(angle), lng: centroid.lng + r * Math.cos(angle) };
}

/** Rounds bounds outward to 3 decimals (~110 m) so tiny pans don't each
 * become a new query. */
export function roundBounds(b: MapBounds): MapBounds {
  return {
    minLat: Math.floor(b.minLat * 1000) / 1000,
    minLng: Math.floor(b.minLng * 1000) / 1000,
    maxLat: Math.ceil(b.maxLat * 1000) / 1000,
    maxLng: Math.ceil(b.maxLng * 1000) / 1000,
  };
}

export function isFresh(updatedAt: string | null | undefined, maxAgeMs: number, now = Date.now()): boolean {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  return Number.isFinite(t) && now - t <= maxAgeMs;
}
