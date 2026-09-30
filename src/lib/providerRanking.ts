/**
 * Provider search: filtering, sorting and the "best match" score. Pure and
 * dependency-free so the ranking can be tested and tuned in one place.
 */

export type SearchProvider = {
  id: string;
  full_name: string;
  initials: string;
  area: string;
  photo_url: string | null;
  tagline: string | null;
  provider_category: string | null;
  provider_rating: number;
  provider_jobs_count: number;
  provider_verified: boolean;
  provider_certified: boolean;
  verification_level?: string | null;
  availability_mode?: string | null;
  /** Real distance from the customer, when we know where they are. */
  distance_km: number | null;
  /** The profile's stored distance figure - display fallback only, never ranked. */
  stored_distance_km: number | null;
};

export type SortKey = 'best' | 'nearest' | 'rating' | 'jobs';

export type ProviderFilters = {
  verifiedOnly: boolean;
  availableNow: boolean;
  maxDistanceKm: number | null;
  minRating: number;
};

export const NO_FILTERS: ProviderFilters = { verifiedOnly: false, availableNow: false, maxDistanceKm: null, minRating: 0 };

/** Best-match weights; they sum to 1. */
export const WEIGHTS = { rating: 0.4, experience: 0.2, proximity: 0.2, trust: 0.1, availability: 0.1 } as const;

/** A rating is shrunk toward this "typical" value by this many pretend jobs,
 * so one 5-star job can't outrank a long record of 4.8s. */
export const RATING_PRIOR = 4.0;
export const RATING_PRIOR_JOBS = 5;
/** Jobs beyond this stop adding to the experience score. */
const EXPERIENCE_CAP_JOBS = 50;
/** Distance at which the proximity score reaches zero. */
export const MAX_RADIUS_KM = 25;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function adjustedRating(rating: number, jobs: number): number {
  return (rating * jobs + RATING_PRIOR * RATING_PRIOR_JOBS) / (jobs + RATING_PRIOR_JOBS);
}

function isVerified(p: SearchProvider): boolean {
  return p.provider_certified || p.provider_verified || (!!p.verification_level && p.verification_level !== 'REGISTERED');
}

/** 0-1: how well a provider fits, all signals combined. */
export function bestMatchScore(p: SearchProvider): number {
  const rating = clamp01((adjustedRating(p.provider_rating, p.provider_jobs_count) - 3) / 2);
  const experience = clamp01(Math.log(1 + p.provider_jobs_count) / Math.log(1 + EXPERIENCE_CAP_JOBS));
  // Unknown distance is neutral: neither rewarded nor punished.
  const proximity = p.distance_km == null ? 0.5 : clamp01(1 - p.distance_km / MAX_RADIUS_KM);
  const trust = p.provider_certified ? 1 : isVerified(p) ? 0.6 : 0.2;
  const availability = p.availability_mode === 'AVAILABLE_NOW' ? 1 : p.availability_mode === 'SCHEDULE' ? 0.5 : p.availability_mode ? 0 : 0.3;

  return (
    WEIGHTS.rating * rating +
    WEIGHTS.experience * experience +
    WEIGHTS.proximity * proximity +
    WEIGHTS.trust * trust +
    WEIGHTS.availability * availability
  );
}

export function applyProviderFilters(list: SearchProvider[], f: ProviderFilters): SearchProvider[] {
  return list.filter((p) => {
    if (p.provider_rating < f.minRating) return false;
    if (f.verifiedOnly && !isVerified(p)) return false;
    if (f.availableNow && p.availability_mode !== 'AVAILABLE_NOW') return false;
    if (f.maxDistanceKm != null && (p.distance_km == null || p.distance_km > f.maxDistanceKm)) return false;
    return true;
  });
}

/** A new sorted array; the input is left alone. Ties keep their input order. */
export function sortProviders(list: SearchProvider[], key: SortKey): SearchProvider[] {
  const indexed = list.map((p, i) => ({ p, i }));
  const cmp: Record<SortKey, (a: SearchProvider, b: SearchProvider) => number> = {
    best: (a, b) => bestMatchScore(b) - bestMatchScore(a),
    nearest: (a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity),
    rating: (a, b) => b.provider_rating - a.provider_rating,
    jobs: (a, b) => b.provider_jobs_count - a.provider_jobs_count,
  };
  // Infinity - Infinity is NaN; treat two unknown distances as a tie.
  const safe = (n: number) => (Number.isNaN(n) ? 0 : n);
  return indexed.sort((x, y) => safe(cmp[key](x.p, y.p)) || x.i - y.i).map((x) => x.p);
}

/** Up to two short reasons this provider is worth a look, most useful first. */
export function matchReasons(p: SearchProvider): string[] {
  const reasons: string[] = [];
  if (p.availability_mode === 'AVAILABLE_NOW') reasons.push('Available now');
  if (p.provider_rating >= 4.7 && p.provider_jobs_count >= 10) reasons.push('Top rated');
  if (p.distance_km != null && p.distance_km <= 5) reasons.push(`${p.distance_km.toFixed(1)} km away`);
  if (p.provider_certified) reasons.push('Certified');
  else if (isVerified(p)) reasons.push('Verified');
  if (p.provider_jobs_count >= 50) reasons.push('Experienced');
  return reasons.slice(0, 2);
}
