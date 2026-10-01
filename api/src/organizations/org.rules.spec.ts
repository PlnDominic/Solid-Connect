import { canManageMembers, nextRunAfter, isOrgMemberRole } from './org.rules';

describe('org rules', () => {
  it('lets owners and admins manage members', () => {
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('member')).toBe(false);
  });

  it('advances recurring schedules', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(nextRunAfter('weekly', from).toISOString()).toBe('2026-01-08T00:00:00.000Z');
    expect(nextRunAfter('biweekly', from).toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(nextRunAfter('monthly', from).toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('validates member roles', () => {
    expect(isOrgMemberRole('admin')).toBe(true);
    expect(isOrgMemberRole('guest')).toBe(false);
  });
});
