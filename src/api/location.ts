import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
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
