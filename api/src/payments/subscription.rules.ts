/** Hubtel client reference for a subscription checkout: ss_ + 32 hex. */
export function subscriptionReference(subscriptionId: string): string {
  return `ss_${subscriptionId.replace(/-/g, '')}`;
}

export const SUBSCRIPTION_REFERENCE = /^ss_[a-f0-9]{32}$/;

export type SubscriptionState = {
  /** Provider has any non-cancelled job: their one free trial job is used. */
  trialUsed: boolean;
  /** Latest paid expiry, if they ever subscribed. */
  expiresAt: Date | null;
  now: Date;
};

export type WorkAccess =
  | { allowed: true; reason: 'TRIAL' | 'SUBSCRIBED' }
  | { allowed: false; reason: 'SUBSCRIPTION_REQUIRED' };

export function workAccess(s: SubscriptionState): WorkAccess {
  if (s.expiresAt && s.expiresAt.getTime() > s.now.getTime()) return { allowed: true, reason: 'SUBSCRIBED' };
  if (!s.trialUsed) return { allowed: true, reason: 'TRIAL' };
  return { allowed: false, reason: 'SUBSCRIPTION_REQUIRED' };
}

/** A renewal stacks on the remaining time instead of overlapping it. */
export function nextPeriod(now: Date, currentExpiry: Date | null, periodDays: number) {
  const start = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const end = new Date(start.getTime() + periodDays * 86_400_000);
  return { startsAt: start, expiresAt: end };
}
