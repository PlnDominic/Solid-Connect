import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { MapBounds } from '../lib/mapPins';

/** A provider on the map, as returned by map_providers (0068). Live
 * providers ("Available now", app open) sit on their ~450 m grid point;
 * everyone else sits on their area's centre. Never an exact spot. */
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
  /** When the live position was last reported; null when not live. */
  updated_at: string | null;
  is_live: boolean;
  /** Neighbourhood the pin stands for (e.g. "Labadi"). */
  area_label: string | null;
  availability_mode: 'AVAILABLE_NOW' | 'SCHEDULE' | 'UNAVAILABLE' | 'PAUSED' | null;
};

/** Every (non-suspended) provider inside the map's visible box - live
 * ones flagged -
 * refreshed every 20s while the map is open. Polling rather than Realtime on purpose: a
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
        is_live: Boolean(row.is_live),
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
