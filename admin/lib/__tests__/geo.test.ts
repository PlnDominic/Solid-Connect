import { describe, it, expect } from 'vitest';
import { haversineKm, formatDistanceKm, formatRelativeTime, mapsUrl } from '../geo';

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: 5.627, lng: -0.232 };
    expect(haversineKm(p, p)).toBeCloseTo(0, 6);
  });

  it('matches the known Achimota <-> Osu distance within a wide tolerance', () => {
    const achimota = { lat: 5.627, lng: -0.232 };
    const osu = { lat: 5.558, lng: -0.183 };
    expect(haversineKm(achimota, osu)).toBeGreaterThan(8);
    expect(haversineKm(achimota, osu)).toBeLessThan(10);
  });
});

describe('formatDistanceKm', () => {
  it('shows meters under 1km', () => {
    expect(formatDistanceKm(0.45)).toBe('450 m');
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

  it('shows minutes between 1 and 60 minutes', () => {
    expect(formatRelativeTime(new Date(Date.now() - 3 * 60_000).toISOString())).toBe('3m ago');
  });

  it('shows hours at 60 minutes and above', () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 60 * 60_000).toISOString())).toBe('2h ago');
  });
});

describe('mapsUrl', () => {
  it('builds a plain Google Maps search URL from lat/lng', () => {
    expect(mapsUrl(5.627, -0.232)).toBe('https://www.google.com/maps/search/?api=1&query=5.627,-0.232');
  });
});
