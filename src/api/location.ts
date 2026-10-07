import * as Location from 'expo-location';
import { getDevicePosition } from '../lib/devicePosition';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { AREA_COORDS, coordsForLabel, matchAreaName } from '../lib/areaCoords';
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

/** A place the user picked: display label + optional WGS84 point for PostGIS. */
export type ResolvedLocation = {
  area: string;
  lat?: number;
  lng?: number;
};

export type DetectAreaResult =
  | ResolvedLocation
  | { error: 'PERMISSION_DENIED' | 'SERVICES_OFF' | 'LOCATION_UNAVAILABLE' };

/** Prefer a known Accra neighbourhood when GPS is this close — more
 * reliable than OS "Ga North Municipal" style labels for Ga West towns. */
const NEIGHBOURHOOD_LABEL_MAX_KM = 3.5;

/** Only use a looser Accra centroid if geocoders give nothing useful. */
const CENTROID_FALLBACK_MAX_KM = 12;

/** Ghana MMDA / region labels — too coarse and often wrong from Apple/Google. */
const COARSE_ADMIN_RE =
  /\b(municipal|metropolis|metropolitan|district assembly|district|region|constituency)\b/i;
const GENERIC_GEO_RE =
  /^(ghana|greater accra|accra|africa|west africa|unnamed road|null)$/i;

/**
 * "Use my current location" — Ghana-wide.
 *
 * Label (what you see) and point (what matching uses) are separate:
 * 1. Read GPS from the phone → always stored for PostGIS.
 * 2. If GPS is within ~3.5 km of a known Accra neighbourhood, use that
 *    name (Sapiman, Amasaman, …). OS geocoders often return the wrong
 *    municipal assembly (Ga North vs Ga West) instead of the town.
 * 3. Else reverse-geocode for a town/suburb — skip Municipal/District
 *    names; prefer OpenStreetMap locality, then the phone OS geocoder.
 * 4. Else nearest Accra centroid within ~12 km, or "Current location".
 */
export async function detectNearestArea(): Promise<DetectAreaResult> {
  const pos = await getDevicePosition();
  if (!pos.ok) {
    if (pos.reason === 'PERMISSION_DENIED') return { error: 'PERMISSION_DENIED' };
    if (pos.reason === 'SERVICES_OFF') return { error: 'SERVICES_OFF' };
    return { error: 'LOCATION_UNAVAILABLE' };
  }

  try {
    const here = { lat: pos.lat, lng: pos.lng };

    const neighbourhood = nearestCentroidWithin(here, NEIGHBOURHOOD_LABEL_MAX_KM);
    if (neighbourhood) return { area: neighbourhood, lat: here.lat, lng: here.lng };

    const geoArea = await areaFromReverseGeocode(here.lat, here.lng);
    if (geoArea) return { area: geoArea, lat: here.lat, lng: here.lng };

    const nearby = nearestCentroidWithin(here, CENTROID_FALLBACK_MAX_KM);
    if (nearby) return { area: nearby, lat: here.lat, lng: here.lng };

    return { area: 'Current location', lat: here.lat, lng: here.lng };
  } catch {
    return { error: 'LOCATION_UNAVAILABLE' };
  }
}

/** Accra chip → known centroid coords (no GPS). */
export function resolvedLocationFromAreaLabel(area: string): ResolvedLocation {
  const label = area.trim();
  const matched = matchAreaName(label);
  const coords = matched ? AREA_COORDS[matched] : undefined;
  return {
    area: matched ?? label,
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
  };
}

function cleanPlaceLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const label = raw.trim().replace(/\s+/g, ' ');
  if (label.length < 2 || label.length > 48) return null;
  if (GENERIC_GEO_RE.test(label) || COARSE_ADMIN_RE.test(label)) return null;
  // Street numbers / plot ids ("12", "Plot 4") are not neighbourhoods.
  if (/^[\d\s./#-]+$/.test(label)) return null;
  return label;
}

function pickBestLabel(candidates: Array<string | null | undefined>): string | null {
  const cleaned = candidates.map(cleanPlaceLabel).filter((v): v is string => !!v);
  for (const label of cleaned) {
    const matched = matchAreaName(label);
    if (matched) return matched;
  }
  return cleaned[0] ?? null;
}

/**
 * Locality label from OSM (suburb/village) then the OS geocoder.
 * Never returns "Ga West Municipal" — those assemblies are coarse and
 * Apple/Google often flip Ga West ↔ Ga North around Amasaman/Sapiman.
 */
async function areaFromReverseGeocode(lat: number, lng: number): Promise<string | null> {
  const fromOsm = await areaFromNominatim(lat, lng);
  if (fromOsm) return fromOsm;

  try {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = places[0];
    if (!place) return null;

    // Prefer place/street locality over district/subregion (often MMDA names).
    const best = pickBestLabel([
      place.name,
      place.street,
      place.city,
      place.district,
      place.subregion,
      typeof place.formattedAddress === 'string'
        ? place.formattedAddress.split(',')[0]
        : null,
    ]);
    if (best) return best;

    const city = cleanPlaceLabel(place.city);
    const region = cleanPlaceLabel(place.region);
    if (city && region) return `${city}, ${region}`;
    return null;
  } catch {
    return null;
  }
}

/** OpenStreetMap Nominatim — better Ghana locality names than MMDA labels. */
async function areaFromNominatim(lat: number, lng: number): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
      `&zoom=16&addressdetails=1`;
    const res = await Promise.race([
      fetch(url, {
        headers: {
          Accept: 'application/json',
          // Nominatim usage policy requires a descriptive User-Agent.
          'User-Agent': 'SolidConnect/1.0 (location; https://solidconnect.app)',
        },
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    if (!res || !res.ok) return null;
    const json = (await res.json()) as {
      name?: string;
      address?: Record<string, string | undefined>;
    };
    const a = json.address ?? {};
    return pickBestLabel([
      a.neighbourhood,
      a.suburb,
      a.village,
      a.hamlet,
      a.town,
      a.city_district,
      a.quarter,
      a.residential,
      json.name,
      a.city,
      a.municipality,
    ]);
  } catch {
    return null;
  }
}

function nearestCentroidWithin(
  here: { lat: number; lng: number },
  maxKm: number,
): string | null {
  let nearestNamed: string | null = null;
  let nearestNamedKm = Infinity;
  for (const [name, coords] of Object.entries(AREA_COORDS)) {
    const distanceKm = haversineKm(here, { lat: coords.lat, lng: coords.lng });
    if (distanceKm < nearestNamedKm) {
      nearestNamedKm = distanceKm;
      nearestNamed = name;
    }
  }
  if (!nearestNamed || nearestNamedKm > maxKm) return null;
  return nearestNamed;
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
