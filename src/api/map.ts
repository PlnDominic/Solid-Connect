import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { MapBounds } from '../lib/mapPins';

/** A provider on the live map, as returned by map_providers (0067). lat/lng
 * are the ~450 m grid point the server stored, never the exact fix. */
export type MapProviderRow = {
  id: string;
  full_name: string;
  initials: string;
  photo_url: string | null;
  provider_category: string | null;
  provider_rating: number;
  provider_jobs_count: number;
  provider_verified: boolean;
  verification_level: string | null;
  lat: number;
  lng: number;
  updated_at: string;
};

/** "Available now" providers inside the map's visible box, refreshed every
 * 20s while the map is open. Polling rather than Realtime on purpose: a
 * viewer only needs a fresh picture every so often, and pushing every
 * provider's every move to every open map doesn't scale. */
export function useMapProviders(bounds: MapBounds | null, category: string | null, enabled = true) {
  return useQuery({
    queryKey: ['mapProviders', bounds, category],
    enabled: enabled && !!bounds,
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
    queryFn: async (): Promise<MapProviderRow[]> => {
      const b = bounds as MapBounds;
      const { data, error } = await supabase.rpc('map_providers', {
        p_min_lat: b.minLat,
        p_min_lng: b.minLng,
        p_max_lat: b.maxLat,
        p_max_lng: b.maxLng,
        p_category: category,
      });
      if (error) throw error;
      return ((data ?? []) as MapProviderRow[]).map((row) => ({
        ...row,
        provider_rating: Number(row.provider_rating ?? 0),
      }));
    },
  });
}

/** True when the server put this provider on the map; false when they
 * aren't eligible (not "Available now", suspended). */
export async function reportProviderPresence(lat: number, lng: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('report_provider_presence', { p_lat: lat, p_lng: lng });
  if (error) throw error;
  return data === true;
}

export async function clearProviderPresence(): Promise<void> {
  const { error } = await supabase.rpc('clear_provider_presence');
  if (error) throw error;
}
