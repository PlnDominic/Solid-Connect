import { accessFromProfile } from './users.access';

describe('accessFromProfile', () => {
  it('reads the active role', () => {
    expect(accessFromProfile({ role: 'provider' })).toEqual({
      activeRole: 'provider',
      suspended: false,
    });
    expect(accessFromProfile({ role: 'customer' })).toEqual({
      activeRole: 'customer',
      suspended: false,
    });
  });

  it('treats a profile with suspended_at set as suspended', () => {
    expect(
      accessFromProfile({
        role: 'customer',
        suspended_at: '2026-10-01T10:00:00Z',
      }).suspended,
    ).toBe(true);
  });

  it('is not suspended when suspended_at is empty', () => {
    expect(
      accessFromProfile({ role: 'customer', suspended_at: null }).suspended,
    ).toBe(false);
  });

  it('has no role and is not suspended when there is no profile yet', () => {
    expect(accessFromProfile(null)).toEqual({
      activeRole: null,
      suspended: false,
    });
    expect(accessFromProfile(undefined)).toEqual({
      activeRole: null,
      suspended: false,
    });
    expect(accessFromProfile({ role: 'something-else' }).activeRole).toBeNull();
  });
});
