import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';
import type { Profile, Role } from '../types/database';

export interface SignUpDetails {
  fullName: string;
  phone: string;
  email: string;
}

function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join('') || '?';
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Creates (or promotes) the current device's profile to the chosen role,
 * using the real details collected in the sign-up flow - no hardcoded demo
 * name, and no fabricated "already verified with 212 jobs" provider stats.
 * A brand-new provider profile starts exactly where the schema defaults
 * say it should: unverified, zero jobs (see supabase/migrations/0001_init.sql).
 */
export async function createOrUpdateOwnProfile(
  userId: string,
  role: Role,
  details: SignUpDetails
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        role,
        full_name: details.fullName,
        initials: initialsFrom(details.fullName),
        phone: details.phone || null,
        email: details.email || null,
        is_seed: false,
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
