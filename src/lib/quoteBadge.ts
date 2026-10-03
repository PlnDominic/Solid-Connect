import type { BadgeKind } from '../types/database';

/**
 * The trust badge stamped on a quote when it's sent. Only claims what the
 * provider has actually earned - an unverified provider can still quote
 * (matching doesn't require verification), but customers must see that.
 */
export function quoteBadgeFor(profile: {
  provider_certified?: boolean | null;
  provider_verified?: boolean | null;
}): { badgeLabel: string; badgeKind: BadgeKind } {
  if (profile.provider_certified) return { badgeLabel: 'Certified', badgeKind: 'certified' };
  if (profile.provider_verified) return { badgeLabel: 'Identity verified', badgeKind: 'verified' };
  return { badgeLabel: 'Not yet verified', badgeKind: 'unverified' };
}
