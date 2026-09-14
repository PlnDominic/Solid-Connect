import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/** Small, fast, deterministic string hash (djb2) - not cryptographic, just
 * needs to spread evenly and give the same result for the same input
 * every time, so a user's in/out bucket for a flag never flips between
 * app opens purely from re-rolling randomly. */
function hashToPercent(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash) % 100;
}

/**
 * Staged rollout - a flag is "on" for a given user only if it's enabled
 * platform-wide AND that user falls inside rollout_percent, decided by a
 * deterministic per-user/per-flag hash rather than a fresh coin flip each
 * render (see hashToPercent). Flags are managed from the admin panel
 * (Settings → Feature flags, owner-only) - see
 * 0035_retention_dispute_window_feature_flags.sql for the table.
 */
export function useFeatureFlag(key: string, userId: string | null | undefined): boolean {
  const { data } = useQuery({
    queryKey: ['featureFlag', key],
    queryFn: async (): Promise<{ enabled: boolean; rollout_percent: number } | null> => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('enabled, rollout_percent')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // A flag that doesn't exist yet, or fails to load, defaults to off -
    // never half-build a feature in front of someone because a network
    // call failed.
    staleTime: 5 * 60 * 1000,
  });

  if (!data || !data.enabled) return false;
  if (data.rollout_percent >= 100) return true;
  if (!userId) return false;
  return hashToPercent(`${userId}:${key}`) < data.rollout_percent;
}
