import { isFresh, isLiveJobStatus, roundBounds, spreadAroundCentroid } from '../mapPins';

describe('spreadAroundCentroid', () => {
  const osu = { lat: 5.558, lng: -0.183 };

  it('always puts the same id in the same place', () => {
    expect(spreadAroundCentroid('req-1', osu)).toEqual(spreadAroundCentroid('req-1', osu));
  });

  it('separates different ids in the same area', () => {
    const a = spreadAroundCentroid('req-1', osu);
    const b = spreadAroundCentroid('req-2', osu);
    expect(a).not.toEqual(b);
  });

  it('stays within the radius', () => {
    for (let i = 0; i < 200; i++) {
      const p = spreadAroundCentroid(`id-${i}`, osu, 0.004);
      expect(Math.hypot(p.lat - osu.lat, p.lng - osu.lng)).toBeLessThanOrEqual(0.004 + 1e-12);
    }
  });
});

describe('roundBounds', () => {
  it('rounds outward so the original box is always covered', () => {
    const b = { minLat: 5.55512, minLng: -0.20049, maxLat: 5.60001, maxLng: -0.1501 };
    const r = roundBounds(b);
    expect(r.minLat).toBeLessThanOrEqual(b.minLat);
    expect(r.minLng).toBeLessThanOrEqual(b.minLng);
    expect(r.maxLat).toBeGreaterThanOrEqual(b.maxLat);
    expect(r.maxLng).toBeGreaterThanOrEqual(b.maxLng);
    expect(r).toEqual({ minLat: 5.555, minLng: -0.201, maxLat: 5.601, maxLng: -0.15 });
  });
});

describe('isFresh', () => {
  const now = new Date('2026-10-04T10:00:00Z').getTime();
  it('accepts a recent timestamp and rejects an old or missing one', () => {
    expect(isFresh('2026-10-04T09:59:00Z', 120_000, now)).toBe(true);
    expect(isFresh('2026-10-04T09:50:00Z', 120_000, now)).toBe(false);
    expect(isFresh(null, 120_000, now)).toBe(false);
    expect(isFresh('not a date', 120_000, now)).toBe(false);
  });
});

describe('isLiveJobStatus', () => {
  it('matches only the statuses that share live location', () => {
    expect(isLiveJobStatus('accepted')).toBe(true);
    expect(isLiveJobStatus('in_progress')).toBe(true);
    expect(isLiveJobStatus('completed')).toBe(false);
    expect(isLiveJobStatus(null)).toBe(false);
  });
});
