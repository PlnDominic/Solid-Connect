import { getDevicePosition } from '../lib/devicePosition';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { AREAS } from '../constants/areas';
import { AREA_COORDS, coordsForLabel } from '../lib/areaCoords';
import { haversineKm } from '../lib/geo';
import type { Profile } from '../types/database';

export type ServiceAreaPayload = {
  type: 'RADIUS' | 'CITY';
  cityName?: string;
  lng?: number;
  lat?: number;
  radiusMeters?: number;
};

type AreasResponse = { data: Array<{ id: string; type: string; city_name: string | null; radius_meters: number | null }> };
type AvailabilityResponse = {
  data: {
    mode: 'AVAILABLE_NOW' | 'UNAVAILABLE' | 'SCHEDULE' | 'PAUSED';
    weekly: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  };
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

export function useMyAvailability() {
  return useQuery({
    queryKey: ['providers', 'me', 'availability'],
    enabled: isApiConfigured(),
    queryFn: async () => {
      const res = await apiFetch<AvailabilityResponse>('/api/v1/providers/me/availability');
      return res.data;
    },
  });
}

export function useSetAvailabilityMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: AvailabilityResponse['data']['mode']) => {
      if (!isApiConfigured()) throw new Error('API not configured');
      return apiFetch('/api/v1/providers/me/availability/mode', {
        method: 'PUT',
        body: JSON.stringify({ mode }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers', 'me', 'availability'] });
    },
  });
}

export function useSaveWeeklyAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) => {
      if (!isApiConfigured()) throw new Error('API not configured');
      return apiFetch('/api/v1/providers/me/availability/weekly', {
        method: 'PUT',
        body: JSON.stringify({ slots }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers', 'me', 'availability'] });
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
