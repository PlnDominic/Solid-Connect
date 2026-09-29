import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { computeOpenSlots, type AvailabilityException, type WeeklyWindow } from '../lib/slots';
import { useProvider } from './marketplace';

export const BOOKING_HORIZON_DAYS = 14;

/**
 * A provider's bookable slots for the next two weeks: their weekly hours
 * and day-off exceptions (both publicly readable), minus the times they
 * are already booked (via the provider_busy_windows RPC, which exposes
 * only start times). Returns ISO start times, ascending.
 */
export function useProviderOpenSlots(providerId: string | null | undefined) {
  const { data: provider } = useProvider(providerId);

  return useQuery({
    queryKey: ['openSlots', providerId],
    enabled: !!providerId,
    // Slots go stale as they're booked; keep the picker honest.
    staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      const from = new Date();
      const to = new Date(from.getTime() + (BOOKING_HORIZON_DAYS + 1) * 86_400_000);

      const [weekly, exceptions, busy] = await Promise.all([
        supabase.from('provider_availability').select('day_of_week,start_time,end_time').eq('provider_id', providerId as string),
        supabase
          .from('provider_availability_exceptions')
          .select('date,available,start_time,end_time')
          .eq('provider_id', providerId as string),
        supabase.rpc('provider_busy_windows', {
          p_provider_id: providerId as string,
          p_from: from.toISOString(),
          p_to: to.toISOString(),
        }),
      ]);
      if (weekly.error) throw weekly.error;
      if (exceptions.error) throw exceptions.error;
      if (busy.error) throw busy.error;

      return computeOpenSlots({
        mode: provider?.availability_mode,
        weekly: (weekly.data ?? []) as WeeklyWindow[],
        exceptions: (exceptions.data ?? []) as AvailabilityException[],
        busy: ((busy.data ?? []) as { starts_at: string }[]).map((r) => r.starts_at),
        from,
        days: BOOKING_HORIZON_DAYS,
      });
    },
  });
}
