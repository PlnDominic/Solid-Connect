import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';
import type { Profile, Role } from '../types/database';

const DEMO_FULL_NAME = 'Kwame Adjei';
const DEMO_INITIALS = 'KA';

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Creates (or promotes) the current device's profile to the chosen role. */
export async function createOrUpdateOwnProfile(userId: string, role: Role): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        role,
        full_name: DEMO_FULL_NAME,
        initials: DEMO_INITIALS,
        area: 'East Legon, Accra',
        is_seed: false,
        provider_category: 'Plumber',
        provider_rating: 4.9,
        provider_jobs_count: 212,
        provider_verified: true,
        provider_certified: true,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function switchOwnRole(userId: string, role: Role): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: !!userId,
  });
}

export function useSwitchRole() {
  const queryClient = useQueryClient();
  const setProfile = useSessionStore((s) => s.setProfile);
  return useMutation({
    mutationFn: (role: Role) => {
      const userId = useSessionStore.getState().userId;
      if (!userId) throw new Error('Not signed in');
      return switchOwnRole(userId, role);
    },
    onSuccess: (profile) => {
      setProfile(profile);
      queryClient.setQueryData(['profile', profile.id], profile);
    },
  });
}
