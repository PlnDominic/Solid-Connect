import { useMyAvailability } from '../api/location';
import { useSessionStore } from '../store/useSessionStore';
import type { Profile } from '../types/database';

export type AvailabilityMode = NonNullable<Profile['availability_mode']>;

/** The signed-in provider's current availability mode, read from Supabase.
 * Changing the mode on the Availability screen refreshes it (same
 * ['providers', 'me', 'availability'] query key). Null for customers. */
export function useMyAvailabilityMode(): AvailabilityMode | null {
  const profile = useSessionStore((s) => s.profile);
  const isProvider = profile?.role === 'provider';
  const { data } = useMyAvailability();
  if (!isProvider) return null;
  return data?.mode ?? profile?.availability_mode ?? null;
}
