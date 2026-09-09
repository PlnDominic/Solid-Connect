import type { Profile } from '../types/database';

const LABELS: Record<NonNullable<Profile['verification_level']>, string> = {
  REGISTERED: 'Registered',
  IDENTITY_VERIFIED: 'Identity verified',
  PROFESSION_VERIFIED: 'Profession verified',
  EXPERIENCE_VERIFIED: 'Experience verified',
  SOLID_CONNECT_VERIFIED: 'Solid Connect verified',
};

/** Human label for the Phase C verification ladder. */
export function verificationLevelLabel(profile: Pick<Profile, 'verification_level' | 'provider_certified' | 'provider_verified'>) {
  if (profile.verification_level) return LABELS[profile.verification_level] ?? profile.verification_level;
  if (profile.provider_certified) return LABELS.SOLID_CONNECT_VERIFIED;
  if (profile.provider_verified) return LABELS.IDENTITY_VERIFIED;
  return LABELS.REGISTERED;
}

export function isIdentityVerified(profile: Pick<Profile, 'verification_level' | 'provider_verified'>) {
  if (profile.provider_verified) return true;
  const level = profile.verification_level;
  return Boolean(
    level &&
      level !== 'REGISTERED' &&
      [
        'IDENTITY_VERIFIED',
        'PROFESSION_VERIFIED',
        'EXPERIENCE_VERIFIED',
        'SOLID_CONNECT_VERIFIED',
      ].includes(level),
  );
}
