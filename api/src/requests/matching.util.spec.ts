import { normalizeLocationLabel, scoreOpportunity } from './matching.util';

describe('matching.util', () => {
  it('scores category + nearby verified provider higher', () => {
    const near = scoreOpportunity({
      categoryMatch: true,
      rating: 4.5,
      certified: false,
      verified: true,
      availableNow: true,
      distanceMeters: 2000,
    });
    const far = scoreOpportunity({
      categoryMatch: false,
      rating: 3,
      certified: false,
      verified: false,
      availableNow: false,
      distanceMeters: 18000,
    });
    expect(near).toBeGreaterThan(far);
  });

  it('normalizes Accra location labels', () => {
    expect(normalizeLocationLabel('Osu')).toBe('Osu, Accra');
    expect(normalizeLocationLabel('Osu, Accra')).toBe('Osu, Accra');
  });
});
