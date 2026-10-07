import type { Role } from '../types/database';

/**
 * Every account - email/password, Google or Apple - must end sign-up with
 * the same required details. This decides which step still needs filling,
 * so a social sign-in that hands us a name and email can't skip phone,
 * area, role/terms or (for providers) trade.
 */
export type SignUpStep = 'name' | 'phone' | 'location' | 'email' | 'role' | 'category';

export type SignUpDetailsSoFar = {
  fullName?: string | null;
  phone?: string | null;
  area?: string | null;
  email?: string | null;
  role?: Role | null;
  termsAccepted?: boolean;
  hasProviderCategory?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Loose but real check: digits/spaces/+/- only, at least 9 digits - enough
// to catch typos without pretending this is OTP-grade validation.
export function isPlausiblePhone(v: string): boolean {
  const digits = v.replace(/[^\d]/g, '');
  return /^[\d+\-\s]+$/.test(v.trim()) && digits.length >= 9;
}

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/** The first required step that isn't satisfied yet, in sign-up order, or
 * null when the account has everything it needs. Used while walking the
 * sign-up wizard (including a first-time Google/Apple account). */
export function firstMissingSignUpStep(d: SignUpDetailsSoFar): SignUpStep | null {
  if ((d.fullName ?? '').trim().length < 2) return 'name';
  if (!isPlausiblePhone(d.phone ?? '')) return 'phone';
  if ((d.area ?? '').trim().length < 2) return 'location';
  if (!isValidEmail(d.email ?? '')) return 'email';
  if (!d.role || !d.termsAccepted) return 'role';
  if (d.role === 'provider' && !d.hasProviderCategory) return 'category';
  return null;
}

/**
 * True when this profile has already finished onboarding as an app user.
 * Phone/email are collected during sign-up, but a Google account can end
 * up with role + terms and no phone (column null). That person is still
 * onboarded — do not restart the funnel on the next Google sign-in.
 */
export function isProfileOnboarded(d: SignUpDetailsSoFar): boolean {
  if ((d.fullName ?? '').trim().length < 2) return false;
  if ((d.area ?? '').trim().length < 2) return false;
  if (!d.role || !d.termsAccepted) return false;
  if (d.role === 'provider' && !d.hasProviderCategory) return false;
  return true;
}

/** What an existing profile row already satisfies. */
export function profileSignUpDetails(p: {
  full_name: string | null;
  phone: string | null;
  area: string | null;
  email: string | null;
  role: Role | null;
  terms_accepted_at?: string | null;
  provider_category?: string | null;
}): SignUpDetailsSoFar {
  return {
    fullName: p.full_name,
    phone: p.phone,
    area: p.area,
    email: p.email,
    role: p.role,
    termsAccepted: Boolean(p.terms_accepted_at),
    hasProviderCategory: Boolean(p.provider_category?.trim()),
  };
}
