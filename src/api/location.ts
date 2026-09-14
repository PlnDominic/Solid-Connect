import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { apiFetch, isApiConfigured } from '../lib/api';
import { AREAS } from '../constants/areas';
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

const AREA_COORDS: Record<string, { lng: number; lat: number }> = {
  Achimota: { lng: -0.232, lat: 5.627 },
  'Trasacco Valley': { lng: -0.158, lat: 5.635 },
  'Airport Residential': { lng: -0.177, lat: 5.605 },
  Cantonments: { lng: -0.173, lat: 5.575 },
  Osu: { lng: -0.183, lat: 5.558 },
  Spintex: { lng: -0.098, lat: 5.636 },
  Tema: { lng: -0.017, lat: 5.669 },
  Dansoman: { lng: -0.266, lat: 5.548 },
};

export function coordsForArea(name: string) {
  return AREA_COORDS[name] ?? null;
}

// Same substring match marketplace.ts's own (module-private) matchAreaName
// uses for provider search - free-text location labels ("Achimota, Accra")
// need to resolve to one of the known named areas before they mean coords.
function matchAreaName(needle: string): string | null {
  const n = needle.trim().toLowerCase();
  return AREAS.find((a) => a.toLowerCase().includes(n) || n.includes(a.toLowerCase())) ?? null;
}

/** Approximate straight-line distance between two free-text location
 * labels, each resolved to its nearest known named area - this app never
 * models a precise address, only "which of these 8 neighborhoods", so
 * this is exactly as precise as location gets anywhere else in the app.
 * Null if either label doesn't match a known area. */
export function distanceBetweenLabelsKm(fromLabel: string, toLabel: string): number | null {
  const fromArea = matchAreaName(fromLabel);
  const toArea = matchAreaName(toLabel);
  if (!fromArea || !toArea) return null;
  const from = coordsForArea(fromArea);
  const to = coordsForArea(toArea);
  if (!from || !to) return null;
  return haversineKm({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
}

/** Coordinates for a free-text location label, via the same area match -
 * used to open a request's neighborhood in the device's own Maps app. */
export function coordsForLabel(label: string): { lat: number; lng: number } | null {
  const area = matchAreaName(label);
  return area ? coordsForArea(area) : null;
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
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { error: 'PERMISSION_DENIED' };

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    let nearestArea: string | null = null;
    let nearestDistanceKm = Infinity;
    for (const [name, coords] of Object.entries(AREA_COORDS)) {
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
