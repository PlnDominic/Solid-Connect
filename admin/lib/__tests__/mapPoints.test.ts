import { describe, expect, it } from 'vitest';
import { AREA_COORDS, matchAreaName, parseGeoPoint, placeProvider, placeRequest, spreadAroundCentroid } from '../mapPoints';

// ST_SetSRID(ST_MakePoint(-0.187, 5.6037), 4326) as hex EWKB.
function ewkbPoint(lng: number, lat: number): string {
  const buf = new DataView(new ArrayBuffer(25));
  buf.setUint8(0, 1);
  buf.setUint32(1, 0x20000001, true);
  buf.setUint32(5, 4326, true);
  buf.setFloat64(9, lng, true);
  buf.setFloat64(17, lat, true);
  return Array.from(new Uint8Array(buf.buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('matchAreaName', () => {
  it('prefers the longest name in the label', () => {
    expect(matchAreaName('Roman Ridge, Accra')).toBe('Roman Ridge');
    expect(matchAreaName('labadi')).toBe('Labadi');
    expect(matchAreaName('Somewhere else')).toBeNull();
  });
});

describe('parseGeoPoint', () => {
  it('reads hex EWKB and GeoJSON points', () => {
    const p = parseGeoPoint(ewkbPoint(-0.187, 5.6037));
    expect(p?.lng).toBeCloseTo(-0.187);
    expect(p?.lat).toBeCloseTo(5.6037);
    expect(parseGeoPoint({ type: 'Point', coordinates: [-0.2, 5.5] })).toEqual({ lng: -0.2, lat: 5.5 });
    expect(parseGeoPoint('not-hex')).toBeNull();
    expect(parseGeoPoint(null)).toBeNull();
  });
});

describe('spreadAroundCentroid', () => {
  it('is stable per id and stays within the radius', () => {
    const c = AREA_COORDS.Osu;
    const a = spreadAroundCentroid('abc', c);
    expect(spreadAroundCentroid('abc', c)).toEqual(a);
    expect(Math.hypot(a.lat - c.lat, a.lng - c.lng)).toBeLessThanOrEqual(0.004 + 1e-9);
  });
});

describe('placeProvider', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  const base = { id: 'p1', availability_mode: 'SCHEDULE', area: 'Osu, Accra', location: null };

  it('uses a fresh presence point only when Available now', () => {
    const presence = { lat: 5.61, lng: -0.19, updated_at: '2026-10-17T11:55:00Z' };
    expect(placeProvider({ ...base, availability_mode: 'AVAILABLE_NOW', presence }, now)).toMatchObject({ lat: 5.61, lng: -0.19, live: true });
    expect(placeProvider({ ...base, presence }, now)?.live).toBe(false);
    const stale = { ...presence, updated_at: '2026-10-17T11:00:00Z' };
    expect(placeProvider({ ...base, availability_mode: 'AVAILABLE_NOW', presence: stale }, now)?.live).toBe(false);
  });

  it('falls back from area to service area to saved location', () => {
    expect(placeProvider(base, now)?.areaLabel).toBe('Osu');
    expect(placeProvider({ ...base, area: null, serviceArea: { city_name: 'Tema', center: null } }, now)?.areaLabel).toBe('Tema');
    const saved = placeProvider({ ...base, area: null, location: ewkbPoint(-0.3, 5.5) }, now);
    expect(saved?.lat).toBeCloseTo(5.5, 1);
    expect(placeProvider({ ...base, area: null }, now)).toBeNull();
  });
});

describe('placeRequest', () => {
  it('places by neighbourhood or not at all', () => {
    expect(placeRequest({ id: 'r1', location_label: 'East Legon, Accra' })?.areaLabel).toBe('East Legon');
    expect(placeRequest({ id: 'r2', location_label: 'Kumasi' })).toBeNull();
  });
});
