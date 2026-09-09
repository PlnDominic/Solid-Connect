import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { becomeProvider, switchActiveRole, syncIdentity } from './identity';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';
import type { Profile, Role } from '../types/database';
import { isApiConfigured } from '../lib/api';

export interface SignUpDetails {
  fullName: string;
  phone: string;
  email: string;
  area?: string;
  providerCategory?: string;
  /** Category ids for multi-service providers. */
  providerCategoryIds?: string[];
}

function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join('') || '?';
}

/**
 * 23505 = unique_violation. A pre-check (isPhoneTaken) can pass and still
 * lose a race to another write - this turns that raw Postgres error into
 * something worth putting in front of a user, same message either way.
 */
function rethrowFriendly(error: { code?: string; message: string }): never {
  if (error.code === '23505' && error.message.includes('profiles_phone_key')) {
    throw new Error('That phone number is already registered to another account.');
  }
  throw error;
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Early sign-up pre-checks, run before advancing off the phone/email step -
 * profiles are publicly readable (see 0001_init.sql policies), so this is
 * just a plain lookup. Not the real guard (a race between this check and
 * account creation is still possible): phone is enforced for real by the
 * unique constraint in 0004_phone_unique.sql, email by Supabase auth's own
 * uniqueness on auth.users. Callers should fail open on a lookup error
 * rather than block sign-up on the pre-check itself.
 */
export async function isPhoneTaken(phone: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from('profiles').select('id').eq('phone', phone).limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function isEmailTaken(email: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from('profiles').select('id').eq('email', email).limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data?.length ?? 0) > 0;
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
        area: details.area?.trim() || 'Achimota, Accra',
        provider_category:
          role === 'provider' ? details.providerCategory?.trim() || null : null,
        is_seed: false,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();
  if (error) rethrowFriendly(error);
  if (isApiConfigured()) {
    await syncIdentity(details.fullName, details.phone).catch(() => null);
    if (role === 'provider') {
      await becomeProvider(
        details.providerCategory,
        undefined,
        details.providerCategoryIds,
      ).catch(() => null);
    }
  } else if (role === 'provider' && details.providerCategoryIds?.length) {
    const { setMyProviderCategories } = await import('./identity');
    await setMyProviderCategories(details.providerCategoryIds);
  }
  if (role === 'provider' && details.providerCategoryIds?.length) {
    const refreshed = await fetchProfile(userId);
    if (refreshed) return refreshed;
  }
  return data;
}

/**
 * Updates the editable fields on the current user's own profile - name,
 * phone, area, and (providers only) trade. Deliberately doesn't touch
 * `email`: that's the real Supabase auth identity, not just a display
 * column, so changing it goes through supabase.auth.updateUser instead
 * (see EditProfileScreen) and profiles.email is synced only once that's
 * actually confirmed.
 */
export async function updateOwnProfile(
  userId: string,
  role: Role,
  updates: {
    fullName: string;
    phone: string;
    area: string;
    providerCategory?: string;
    providerCategoryIds?: string[];
    tagline?: string;
  },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: updates.fullName,
      initials: initialsFrom(updates.fullName),
      phone: updates.phone || null,
      area: updates.area.trim() || 'Achimota, Accra',
      tagline: updates.tagline?.trim() || null,
      ...(role === 'provider' && !updates.providerCategoryIds?.length
        ? { provider_category: updates.providerCategory?.trim() || null }
        : {}),
    })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) rethrowFriendly(error);

  if (role === 'provider' && updates.providerCategoryIds?.length) {
    const { setMyProviderCategories } = await import('./identity');
    await setMyProviderCategories(updates.providerCategoryIds);
    const refreshed = await fetchProfile(userId);
    if (refreshed) return refreshed;
  }
  return data;
}

/**
 * Uploads one picked image to the public profile-photos bucket under the
 * user's own folder, then points profiles.photo_url at it. Path always
 * includes a fresh timestamp (never overwrites in place) so a stale CDN/
 * client cache of the old URL can't mask the update.
 */
export async function uploadOwnProfilePhoto(userId: string, imageUri: string): Promise<Profile> {
  const response = await fetch(imageUri);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${userId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;
  const { data: publicUrl } = supabase.storage.from('profile-photos').getPublicUrl(path);
  const { data, error } = await supabase
    .from('profiles')
    .update({ photo_url: publicUrl.publicUrl })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Syncs profiles.email once Supabase auth's own email is confirmed changed. */
export async function updateOwnProfileEmail(userId: string, email: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ email }).eq('id', userId);
  if (error) throw error;
}

/**
 * Records the outcome of the post-sign-up notification prompt - status is
 * always set ('granted' / 'denied' / 'skipped'), token only when a real one
 * came back (see src/lib/pushNotifications.ts for when it doesn't).
 */
export async function savePushSubscription(
  userId: string,
  status: 'granted' | 'denied' | 'skipped',
  token: string | null
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_permission_status: status, push_token: token })
    .eq('id', userId);
  if (error) throw error;
}

export async function switchOwnRole(userId: string, role: Role): Promise<Profile> {
  // Prefer NestJS ownership of role grants / active mode when API is configured.
  if (isApiConfigured()) {
    if (role === 'provider') {
      const me = await switchActiveRole('provider').catch(async () => {
        // First-time provider: grant role then switch.
        await becomeProvider();
        return switchActiveRole('provider');
      });
      if (me?.data.profile) return me.data.profile;
    } else {
      const me = await switchActiveRole('customer');
      if (me?.data.profile) return me.data.profile;
    }
  }

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

export function useUploadProfilePhoto() {
  const queryClient = useQueryClient();
  const setProfile = useSessionStore((s) => s.setProfile);
  return useMutation({
    // Takes the caller's own profile.id rather than reading userId from the
    // session store - that field is only ever cleared to null on sign-out,
    // never set to a real value anywhere in the app (same latent bug
    // useSwitchRole has), so relying on it here always threw "Not signed in".
    mutationFn: ({ userId, imageUri }: { userId: string; imageUri: string }) => uploadOwnProfilePhoto(userId, imageUri),
    onSuccess: (profile) => {
      setProfile(profile);
      queryClient.setQueryData(['profile', profile.id], profile);
    },
  });
}

export function useSwitchRole() {
  const queryClient = useQueryClient();
  const setProfile = useSessionStore((s) => s.setProfile);
  return useMutation({
    // Same fix as useUploadProfilePhoto: take the caller's profile.id
    // instead of the session store's userId, which is never actually set
    // to a real value anywhere in the app - this always threw "Not signed
    // in" before, meaning role switching has never worked.
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => switchOwnRole(userId, role),
    onSuccess: (profile) => {
      setProfile(profile);
      queryClient.setQueryData(['profile', profile.id], profile);
    },
  });
}
