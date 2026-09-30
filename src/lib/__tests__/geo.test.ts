import { haversineKm, formatDistanceKm, formatRelativeTime, estimateEtaMinutes, formatEta } from '../geo';

describe('estimateEtaMinutes', () => {
  it('is 1 minute at minimum, never 0', () => {
    expect(estimateEtaMinutes(0)).toBe(1);
    expect(estimateEtaMinutes(0.05)).toBe(1);
  });

  it('assumes ~25 km/h city speed', () => {
    expect(estimateEtaMinutes(5)).toBe(12);
    expect(estimateEtaMinutes(25)).toBe(60);
  });

  it('rounds up so we never promise an arrival that is too early', () => {
    expect(estimateEtaMinutes(1)).toBe(3); // 2.4 -> 3
  });

  it('returns null for missing or invalid distances', () => {
    expect(estimateEtaMinutes(null)).toBeNull();
    expect(estimateEtaMinutes(NaN)).toBeNull();
    expect(estimateEtaMinutes(-1)).toBeNull();
  });
});

describe('formatEta', () => {
  it('shows minutes under an hour', () => {
    expect(formatEta(1)).toBe('about 1 min');
    expect(formatEta(12)).toBe('about 12 min');
  });

  it('shows hours and minutes from 60 minutes', () => {
    expect(formatEta(60)).toBe('about 1 h');
    expect(formatEta(95)).toBe('about 1 h 35 min');
  });
});

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: 5.627, lng: -0.232 };
    expect(haversineKm(p, p)).toBeCloseTo(0, 6);
  });

  it('matches the known Achimota <-> Osu distance within PostGIS/geography rounding tolerance', () => {
    // Same two points used as area_centroids in 0012_trust_location.sql.
    const achimota = { lat: 5.627, lng: -0.232 };
    const osu = { lat: 5.558, lng: -0.183 };
    // ~9.1km by great-circle distance - a wide tolerance since this test
    // only needs to catch a broken formula, not validate precise geodesy.
    expect(haversineKm(achimota, osu)).toBeGreaterThan(8);
    expect(haversineKm(achimota, osu)).toBeLessThan(10);
  });

  it('is symmetric', () => {
    const a = { lat: 5.6, lng: -0.2 };
    const b = { lat: 5.61, lng: -0.21 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

describe('formatDistanceKm', () => {
  it('shows meters under 1km', () => {
    expect(formatDistanceKm(0.45)).toBe('450 m');
  });

  it('rounds to the nearest meter under 1km', () => {
    expect(formatDistanceKm(0.001)).toBe('1 m');
  });

  it('shows one decimal between 1km and 10km', () => {
    expect(formatDistanceKm(1.2)).toBe('1.2 km');
  });

  it('shows whole km at 10km and above', () => {
    expect(formatDistanceKm(12.7)).toBe('13 km');
  });
});

describe('formatRelativeTime', () => {
  it('says "just now" for under 10 seconds', () => {
    expect(formatRelativeTime(new Date(Date.now() - 5_000).toISOString())).toBe('just now');
  });

  it('shows seconds between 10s and 1 minute', () => {
    expect(formatRelativeTime(new Date(Date.now() - 42_000).toISOString())).toBe('42s ago');
  });

  it('shows minutes between 1 and 60 minutes', () => {
    expect(formatRelativeTime(new Date(Date.now() - 3 * 60_000).toISOString())).toBe('3m ago');
  });

  it('shows hours at 60 minutes and above', () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 60 * 60_000).toISOString())).toBe('2h ago');
  });

  it('never goes negative for a clock-skewed future timestamp', () => {
    expect(formatRelativeTime(new Date(Date.now() + 10_000).toISOString())).toBe('just now');
  });
});
