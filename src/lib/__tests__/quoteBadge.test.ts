import { quoteBadgeFor } from '../quoteBadge';

describe('quoteBadgeFor', () => {
  it('only claims what the provider has earned', () => {
    expect(quoteBadgeFor({ provider_certified: true, provider_verified: true }).badgeKind).toBe('certified');
    expect(quoteBadgeFor({ provider_certified: false, provider_verified: true }).badgeKind).toBe('verified');
    expect(quoteBadgeFor({ provider_certified: false, provider_verified: false })).toEqual({
      badgeLabel: 'Not yet verified',
      badgeKind: 'unverified',
    });
    expect(quoteBadgeFor({}).badgeKind).toBe('unverified');
  });
});
