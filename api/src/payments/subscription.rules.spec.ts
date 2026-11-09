import { nextPeriod, SUBSCRIPTION_REFERENCE, subscriptionReference, workAccess } from './subscription.rules';

const now = new Date('2026-11-09T00:00:00Z');
const future = new Date('2027-01-01T00:00:00Z');
const past = new Date('2026-01-01T00:00:00Z');

describe('workAccess', () => {
  it('lets a new provider work on their free trial', () => {
    expect(workAccess({ trialUsed: false, expiresAt: null, now })).toEqual({ allowed: true, reason: 'TRIAL' });
  });
  it('blocks once the trial job exists and there is no subscription', () => {
    expect(workAccess({ trialUsed: true, expiresAt: null, now })).toEqual({ allowed: false, reason: 'SUBSCRIPTION_REQUIRED' });
  });
  it('blocks when the subscription has expired', () => {
    expect(workAccess({ trialUsed: true, expiresAt: past, now }).allowed).toBe(false);
  });
  it('allows an active subscription', () => {
    expect(workAccess({ trialUsed: true, expiresAt: future, now })).toEqual({ allowed: true, reason: 'SUBSCRIBED' });
  });
});

describe('nextPeriod', () => {
  it('starts now when there is no active subscription', () => {
    const p = nextPeriod(now, past, 365);
    expect(p.startsAt).toEqual(now);
    expect(p.expiresAt.toISOString()).toBe('2027-11-09T00:00:00.000Z');
  });
  it('stacks on remaining time when renewing early', () => {
    const p = nextPeriod(now, future, 365);
    expect(p.startsAt).toEqual(future);
    expect(p.expiresAt.toISOString()).toBe('2028-01-01T00:00:00.000Z');
  });
});

describe('subscriptionReference', () => {
  it('matches the callback pattern', () => {
    expect(SUBSCRIPTION_REFERENCE.test(subscriptionReference('0b5f3c1e-2a4d-4a6e-9c1d-1234567890ab'))).toBe(true);
  });
});
