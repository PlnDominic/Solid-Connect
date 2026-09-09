import { assertServiceAreas } from './service-areas.util';

describe('assertServiceAreas', () => {
  it('accepts CITY areas with cityName', () => {
    expect(() => assertServiceAreas([{ type: 'CITY', cityName: 'Osu' }])).not.toThrow();
  });

  it('rejects CITY without cityName', () => {
    expect(() => assertServiceAreas([{ type: 'CITY' }])).toThrow(/cityName/i);
  });

  it('accepts RADIUS with coords', () => {
    expect(() =>
      assertServiceAreas([{ type: 'RADIUS', lng: -0.18, lat: 5.55, radiusMeters: 5000 }]),
    ).not.toThrow();
  });

  it('rejects incomplete RADIUS', () => {
    expect(() => assertServiceAreas([{ type: 'RADIUS', lng: -0.18, lat: 5.55 }])).toThrow(/RADIUS/i);
  });
});
