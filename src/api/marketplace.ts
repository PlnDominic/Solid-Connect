import { useQuery } from '@tanstack/react-query';
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
