import { getDevicePosition } from '../lib/devicePosition';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { AREAS } from '../constants/areas';
import { AREA_COORDS, coordsForLabel } from '../lib/areaCoords';
import { haversineKm } from '../lib/geo';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';
import type { Profile } from '../types/database';

export type ServiceAreaPayload = {
  type: 'RADIUS' | 'CITY';
  cityName?: string;
  lng?: number;
  lat?: number;
  radiusMeters?: number;
};

type AreasResponse = { data: Array<{ id: string; type: string; city_name: string | null; radius_meters: number | null }> };
export type AvailabilityMode = 'AVAILABLE_NOW' | 'UNAVAILABLE' | 'SCHEDULE' | 'PAUSED';
export type MyAvailability = {
  mode: AvailabilityMode;
  weekly: Array<{ day_of_week: number; start_time: string; end_time: string }>;
};
type SearchResponse = { data: Profile[] };

export { coordsForArea, coordsForLabel } from '../lib/areaCoords';

/** Approximate straight-line distance between two free-text location
 * labels, each resolved to its nearest known named area - this app never
 * models a precise address, only "which neighbourhood", so this is exactly
 * as precise as location gets anywhere else in the app. Null if either
 * label doesn't match a known area. */
export function distanceBetweenLabelsKm(fromLabel: string, toLabel: string): number | null {
  const from = coordsForLabel(fromLabel);
  const to = coordsForLabel(toLabel);
  if (!from || !to) return null;
  return haversineKm({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
}

export type DetectAreaResult =
  | { area: string }
  | { error: 'PERMISSION_DENIED' | 'LOCATION_UNAVAILABLE' };

/**
 * "Use my current location" - reads the device's actual GPS position and
 * picks the nearest of AREA_COORDS' known neighborhoods by straight-line
 * distance. Deliberately not a reverse-geocoding API call: the app only
 * ever models location as one of these named areas (AreaPicker), never a
 * street address, so snapping to the closest known area is the correct
 * granularity here, not an approximation of a finer one.
 */
export async function detectNearestArea(): Promise<DetectAreaResult> {
  const pos = await getDevicePosition();
  if (!pos.ok) return { error: pos.reason === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'LOCATION_UNAVAILABLE' };

  try {
    const position = { coords: { latitude: pos.lat, longitude: pos.lng } };
    let nearestArea: string | null = null;
    let nearestDistanceKm = Infinity;
    // Snaps to the quick-pick areas (AreaPicker's chips), as before.
    for (const name of AREAS) {
      const coords = AREA_COORDS[name];
      if (!coords) continue;
      const distanceKm = haversineKm(
        { lat: position.coords.latitude, lng: position.coords.longitude },
        { lat: coords.lat, lng: coords.lng },
      );
      if (distanceKm < nearestDistanceKm) {
        nearestDistanceKm = distanceKm;
        nearestArea = name;
      }
    }
    if (!nearestArea) return { error: 'LOCATION_UNAVAILABLE' };
    return { area: nearestArea };
  } catch {
    return { error: 'LOCATION_UNAVAILABLE' };
  }
}

export function useMyServiceAreas() {
  return useQuery({
    queryKey: ['providers', 'me', 'service-areas'],
    enabled: isApiConfigured(),
    queryFn: async () => {
      const res = await apiFetch<AreasResponse>('/api/v1/providers/me/service-areas');
      return res.data;
    },
  });
}

export async function saveCityServiceAreas(cityNames: string[]) {
  return saveProviderCoverage({ cityNames, radius: null });
}

/** CITY neighborhoods plus optional RADIUS around a hub (exit scenario: 10 km). */
export async function saveProviderCoverage(input: {
  cityNames: string[];
  radius: { lng: number; lat: number; radiusMeters: number } | null;
}) {
  if (!isApiConfigured()) return null;
  const areas: ServiceAreaPayload[] = input.cityNames.map((cityName) => ({ type: 'CITY', cityName }));
  if (input.radius) {
    areas.push({
      type: 'RADIUS',
      lng: input.radius.lng,
      lat: input.radius.lat,
      radiusMeters: input.radius.radiusMeters,
    });
  }
  return apiFetch<AreasResponse>('/api/v1/providers/me/service-areas', {
    method: 'PUT',
    body: JSON.stringify({ areas }),
  });
}

/** The signed-in provider's availability mode and weekly hours. Read straight
 * from Supabase (profiles.availability_mode, provider_availability), so it
 * works without the Nest API. */
export function useMyAvailability() {
  const profile = useSessionStore((st) => st.profile);
  const isProvider = profile?.role === 'provider';
  return useQuery({
    queryKey: ['providers', 'me', 'availability', profile?.id],
    enabled: isProvider,
    queryFn: async (): Promise<MyAvailability> => {
      const [{ data: weekly, error: weeklyError }, { data: row, error: modeError }] = await Promise.all([
        supabase
          .from('provider_availability')
          .select('day_of_week, start_time, end_time')
          .eq('provider_id', profile?.id as string)
          .order('day_of_week'),
        supabase.from('profiles').select('availability_mode').eq('id', profile?.id as string).maybeSingle(),
      ]);
      if (weeklyError) throw weeklyError;
      if (modeError) throw modeError;
      return {
        mode: (row?.availability_mode as AvailabilityMode | undefined) ?? 'SCHEDULE',
        weekly: (weekly ?? []) as MyAvailability['weekly'],
      };
    },
  });
}

/** Turns a database error from the availability functions into plain words. */
export function friendlyAvailabilityError(e: unknown): string {
  const message = e instanceof Error ? e.message : typeof (e as { message?: unknown })?.message === 'string' ? (e as { message: string }).message : '';
  if (/PGRST202|set_my_availability_mode|replace_my_weekly_availability|does not exist/i.test(message)) {
    return 'Availability is not set up on the server yet. Please try again later.';
  }
  if (message.includes('NOT_A_PROVIDER')) return 'Only providers can set availability.';
  return message || 'Could not save your availability. Please try again.';
}

export function useSetAvailabilityMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: AvailabilityMode) => {
      const { error } = await supabase.rpc('set_my_availability_mode', { p_mode: mode });
      if (error) throw error;
      return mode;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers', 'me', 'availability'] });
      qc.invalidateQueries({ queryKey: ['feedRequests'] });
    },
  });
}

export function useSaveWeeklyAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) => {
      const { error } = await supabase.rpc('replace_my_weekly_availability', { p_slots: slots });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers', 'me', 'availability'] });
      qc.invalidateQueries({ queryKey: ['feedRequests'] });
    },
  });
}

/** Geo search via Nest when API + coords available; else null so callers fall back. */
export async function searchProvidersGeo(input: {
  lng: number;
  lat: number;
  radiusMeters?: number;
  category?: string;
}): Promise<Profile[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const params = new URLSearchParams({
      lng: String(input.lng),
      lat: String(input.lat),
      radiusMeters: String(input.radiusMeters ?? 10000),
    });
    if (input.category) params.set('category', input.category);
    const res = await apiFetch<SearchResponse>(`/api/v1/providers/search?${params}`);
    return res.data ?? [];
  } catch {
    return null;
  }
}
