import { useQuery } from '@tanstack/react-query';
import { useMyAvailability } from '../api/location';
import { isApiConfigured } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';
import type { Profile } from '../types/database';

export type AvailabilityMode = NonNullable<Profile['availability_mode']>;

/** The signed-in provider's current availability mode. Reads the Nest API
 * when it's configured (that's where AvailabilityScreen writes it), and the
 * profile row otherwise. Both live under the ['providers', 'me',
 * 'availability'] key prefix, so changing the mode refreshes either one. */
export function useMyAvailabilityMode(): AvailabilityMode | null {
  const profile = useSessionStore((s) => s.profile);
  const isProvider = profile?.role === 'provider';
  const api = useMyAvailability();
  const db = useQuery({
    queryKey: ['providers', 'me', 'availability', 'profile', profile?.id],
    enabled: isProvider && !isApiConfigured(),
    queryFn: async (): Promise<AvailabilityMode | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('availability_mode')
        .eq('id', profile?.id as string)
        .maybeSingle();
      if (error) throw error;
      return (data?.availability_mode as AvailabilityMode | undefined) ?? null;
    },
  });
  if (!isProvider) return null;
  return api.data?.mode ?? db.data ?? profile?.availability_mode ?? null;
}
