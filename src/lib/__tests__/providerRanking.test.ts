import {
  adjustedRating,
  applyProviderFilters,
  bestMatchScore,
  matchReasons,
  sortProviders,
  type ProviderFilters,
  type SearchProvider,
} from '../providerRanking';

const base: SearchProvider = {
  id: 'p',
  full_name: 'Provider',
  initials: 'P',
  area: 'Osu',
  photo_url: null,
  tagline: null,
  provider_category: 'Plumbing',
  provider_rating: 4.5,
  provider_jobs_count: 20,
  provider_verified: false,
  provider_certified: false,
  verification_level: 'REGISTERED',
  availability_mode: 'SCHEDULE',
  distance_km: 5,
  stored_distance_km: null,
};
const make = (over: Partial<SearchProvider>): SearchProvider => ({ ...base, ...over });

describe('adjustedRating', () => {
  it('pulls a tiny sample toward the prior', () => {
    expect(adjustedRating(5, 1)).toBeCloseTo(4.1667, 3);
  });

  it('barely moves a large sample', () => {
    expect(adjustedRating(4.8, 100)).toBeCloseTo(4.762, 3);
  });

  it('is the prior for a provider with no jobs', () => {
    expect(adjustedRating(0, 0)).toBe(4);
  });
});

describe('bestMatchScore', () => {
  it('ranks a proven 4.8 above an untested 5.0', () => {
    const proven = make({ provider_rating: 4.8, provider_jobs_count: 100 });
    const untested = make({ provider_rating: 5, provider_jobs_count: 1 });
    expect(bestMatchScore(proven)).toBeGreaterThan(bestMatchScore(untested));
  });

  it('prefers nearer providers, all else equal', () => {
    expect(bestMatchScore(make({ distance_km: 1 }))).toBeGreaterThan(bestMatchScore(make({ distance_km: 20 })));
  });

  it('treats an unknown distance as neutral, not as far or as close', () => {
    const unknown = bestMatchScore(make({ distance_km: null }));
    expect(unknown).toBeLessThan(bestMatchScore(make({ distance_km: 1 })));
    expect(unknown).toBeGreaterThan(bestMatchScore(make({ distance_km: 25 })));
  });

  it('rewards trust and availability', () => {
    expect(bestMatchScore(make({ provider_certified: true }))).toBeGreaterThan(bestMatchScore(make({})));
    expect(bestMatchScore(make({ availability_mode: 'AVAILABLE_NOW' }))).toBeGreaterThan(bestMatchScore(make({})));
  });

  it('stays between 0 and 1', () => {
    const best = make({ provider_rating: 5, provider_jobs_count: 500, distance_km: 0, provider_certified: true, availability_mode: 'AVAILABLE_NOW' });
    const worst = make({ provider_rating: 0, provider_jobs_count: 0, distance_km: 99, availability_mode: 'PAUSED' });
    expect(bestMatchScore(best)).toBeLessThanOrEqual(1);
    expect(bestMatchScore(worst)).toBeGreaterThanOrEqual(0);
  });
});

describe('applyProviderFilters', () => {
  const list = [
    make({ id: 'a', provider_verified: true, distance_km: 2, availability_mode: 'AVAILABLE_NOW', provider_rating: 4.9 }),
    make({ id: 'b', distance_km: 8, provider_rating: 4.1 }),
    make({ id: 'c', provider_certified: true, distance_km: null, provider_rating: 3.5 }),
    make({ id: 'd', verification_level: 'IDENTITY_VERIFIED', distance_km: 30 }),
  ];
  const none: ProviderFilters = { verifiedOnly: false, availableNow: false, maxDistanceKm: null, minRating: 0 };
  const ids = (f: Partial<ProviderFilters>) => applyProviderFilters(list, { ...none, ...f }).map((p) => p.id);

  it('passes everything with no filters', () => {
    expect(ids({})).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps only verified, certified or identity-verified providers', () => {
    expect(ids({ verifiedOnly: true })).toEqual(['a', 'c', 'd']);
  });

  it('keeps only providers available now', () => {
    expect(ids({ availableNow: true })).toEqual(['a']);
  });

  it('applies a distance cap and drops providers with no known distance', () => {
    expect(ids({ maxDistanceKm: 10 })).toEqual(['a', 'b']);
  });

  it('applies a minimum rating', () => {
    expect(ids({ minRating: 4 })).toEqual(['a', 'b', 'd']);
  });
});

describe('sortProviders', () => {
  const list = [
    make({ id: 'far', distance_km: 12, provider_rating: 4.9, provider_jobs_count: 5 }),
    make({ id: 'near', distance_km: 1, provider_rating: 4.0, provider_jobs_count: 200 }),
    make({ id: 'unknown', distance_km: null, provider_rating: 4.5, provider_jobs_count: 50 }),
  ];

  it('sorts nearest first, unknown distances last', () => {
    expect(sortProviders(list, 'nearest').map((p) => p.id)).toEqual(['near', 'far', 'unknown']);
  });

  it('sorts top rated first', () => {
    expect(sortProviders(list, 'rating').map((p) => p.id)).toEqual(['far', 'unknown', 'near']);
  });

  it('sorts most jobs first', () => {
    expect(sortProviders(list, 'jobs').map((p) => p.id)).toEqual(['near', 'unknown', 'far']);
  });

  it('does not mutate the input', () => {
    const copy = [...list];
    sortProviders(list, 'nearest');
    expect(list).toEqual(copy);
  });
});

describe('matchReasons', () => {
  it('gives at most two reasons, most useful first', () => {
    const r = matchReasons(make({ availability_mode: 'AVAILABLE_NOW', provider_rating: 4.9, provider_jobs_count: 80, distance_km: 1.2, provider_certified: true }));
    expect(r).toHaveLength(2);
    expect(r[0]).toBe('Available now');
  });

  it('mentions distance only when the provider is really close', () => {
    expect(matchReasons(make({ distance_km: 2.34 }))).toContain('2.3 km away');
    expect(matchReasons(make({ distance_km: 12 })).some((x) => x.includes('km away'))).toBe(false);
  });

  it('can be empty for an unremarkable provider', () => {
    expect(matchReasons(make({ provider_rating: 4.0, provider_jobs_count: 3, distance_km: 15 }))).toEqual([]);
  });
});
