import { coordsForLabel, matchAreaName } from '../areaCoords';

describe('matchAreaName', () => {
  it('resolves neighbourhoods beyond the sign-up quick picks', () => {
    expect(matchAreaName('Labadi, Accra')).toBe('Labadi');
    expect(matchAreaName('East Legon, Accra')).toBe('East Legon');
    expect(matchAreaName('madina')).toBe('Madina');
  });

  it('prefers the longest name inside the label', () => {
    expect(matchAreaName('Roman Ridge, Accra')).toBe('Roman Ridge');
    expect(matchAreaName('Ridge, Accra')).toBe('Ridge');
  });

  it('matches a typed fragment of a name', () => {
    expect(matchAreaName('east leg')).toBe('East Legon');
  });

  it('returns null for unknown or too-short labels', () => {
    expect(matchAreaName('Kumasi')).toBeNull();
    expect(matchAreaName('a')).toBeNull();
    expect(matchAreaName('')).toBeNull();
  });
});

describe('coordsForLabel', () => {
  it('gives the area centre for a known label', () => {
    expect(coordsForLabel('Labadi, Accra')).toEqual({ lng: -0.15, lat: 5.56 });
  });
});
