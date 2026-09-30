import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDevicePosition } from '../lib/devicePosition';
import { supabase } from '../lib/supabase';
import { MAX_RADIUS_KM, type SearchProvider } from '../lib/providerRanking';
import type { Profile } from '../types/database';
import { coordsForLabel } from './location';
import { useAllProviders } from './marketplace';

export type SearchOrigin = { lat: number; lng: number; source: 'device' | 'area' };

/** Where distances are measured from: the phone's position when it can be
 * read, otherwise the centre of the customer's profile area, otherwise
 * nowhere (distance features stay off rather than guessing). */
export function useSearchOrigin(profileArea: string | null | undefined) {
  return useQuery({
    queryKey: ['searchOrigin', profileArea ?? null],
    queryFn: async (): Promise<SearchOrigin | null> => {
      const pos = await getDevicePosition();
      if (pos.ok) return { lat: pos.lat, lng: pos.lng, source: 'device' };
      const centre = profileArea ? coordsForLabel(profileArea) : null;
      return centre ? { lat: centre.lat, lng: centre.lng, source: 'area' } : null;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Real distances (km, by provider id) from the origin, from the database's
 * PostGIS search. Only providers with usable coverage data appear, and at
 * most the 50 nearest - everyone else simply has no known distance. */
function useDistancesFrom(origin: SearchOrigin | null | undefined, categoryName: string | null) {
  return useQuery({
    queryKey: ['providerDistances', origin?.lat ?? null, origin?.lng ?? null, categoryName],
    enabled: !!origin,
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('search_providers_geo', {
        p_lng: origin!.lng,
        p_lat: origin!.lat,
        p_radius_meters: MAX_RADIUS_KM * 1000,
        p_category: categoryName,
        p_min_verification: null,
      });
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of (data ?? []) as { id: string; distance_meters: number | null }[]) {
        if (row.distance_meters != null) map.set(row.id, row.distance_meters / 1000);
      }
      return map;
    },
  });
}

function toSearchProvider(p: Profile, distanceKm: number | null): SearchProvider {
  return {
    id: p.id,
    full_name: p.full_name,
    initials: p.initials,
    area: p.area,
    photo_url: p.photo_url,
    tagline: p.tagline,
    provider_category: p.provider_category,
    provider_rating: Number(p.provider_rating) || 0,
    provider_jobs_count: p.provider_jobs_count ?? 0,
    provider_verified: !!p.provider_verified,
    provider_certified: !!p.provider_certified,
    verification_level: p.verification_level ?? null,
    availability_mode: p.availability_mode ?? null,
    distance_km: distanceKm,
    stored_distance_km: p.provider_distance_km,
  };
}

/**
 * Every provider for a trade, each carrying its real distance from the
 * customer where one is known. The full list is the base (so nobody
 * vanishes for lacking geo data); the distance lookup only adds to it.
 */
export function useProviderSearch(input: {
  categoryName: string | null;
  profileArea: string | null | undefined;
  limit: number;
}) {
  const { data: origin } = useSearchOrigin(input.profileArea);
  const all = useAllProviders(input.categoryName, input.profileArea ?? null, { limit: input.limit });
  const distances = useDistancesFrom(origin, input.categoryName);

  const providers = useMemo(
    () => (all.data ?? []).map((p) => toSearchProvider(p, distances.data?.get(p.id) ?? null)),
    [all.data, distances.data],
  );

  return {
    providers,
    origin: origin ?? null,
    hasDistances: !!distances.data && distances.data.size > 0,
    isLoading: all.isLoading,
    refetch: async () => {
      await Promise.all([all.refetch(), distances.refetch()]);
    },
  };
}
