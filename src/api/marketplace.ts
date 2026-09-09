import { useQuery } from '@tanstack/react-query';
import { AREAS } from '../constants/areas';
import { coordsForArea, searchProvidersGeo } from './location';
import { isApiConfigured } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Category, Profile } from '../types/database';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
  });
}

/** "Top rated nearby" on the customer home screen. */
export function useTopProviders() {
  return useQuery({
    queryKey: ['providers', 'top-rated'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'provider')
        .order('provider_rating', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function matchAreaName(needle: string) {
  const n = needle.trim().toLowerCase();
  return AREAS.find((a) => a.toLowerCase().includes(n) || n.includes(a.toLowerCase())) ?? null;
}

/** All providers, optionally filtered by category and/or area. Uses Nest geo search when API + area coords exist. */
export function useAllProviders(categoryName?: string | null, areaNeedle?: string | null) {
  return useQuery({
    queryKey: ['providers', 'all', categoryName ?? null, areaNeedle ?? null, isApiConfigured()],
    queryFn: async (): Promise<Profile[]> => {
      const areaName = areaNeedle?.trim() ? matchAreaName(areaNeedle) : null;
      const coords = areaName ? coordsForArea(areaName) : null;

      if (coords && isApiConfigured()) {
        const geo = await searchProvidersGeo({
          lng: coords.lng,
          lat: coords.lat,
          category: categoryName ?? undefined,
        });
        if (geo) return geo;
      }

      let query = supabase.from('profiles').select('*').eq('role', 'provider').order('provider_rating', { ascending: false });
      if (categoryName) query = query.eq('provider_category', categoryName);
      const { data, error } = await query;
      if (error) throw error;
      let rows = data ?? [];
      if (areaNeedle?.trim()) {
        const needle = areaNeedle.trim().toLowerCase();
        rows = [...rows].sort((a, b) => {
          const aHit = (a.area ?? '').toLowerCase().includes(needle) ? 1 : 0;
          const bHit = (b.area ?? '').toLowerCase().includes(needle) ? 1 : 0;
          if (aHit !== bHit) return bHit - aHit;
          return b.provider_rating - a.provider_rating;
        });
      }
      return rows;
    },
  });
}

export function useProvider(providerId: string | null | undefined) {
  return useQuery({
    queryKey: ['provider', providerId],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', providerId as string).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!providerId,
  });
}
