import { apiFetch, isApiConfigured } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Profile, Role } from '../types/database';

type MeResponse = {
  data: {
    id: string;
    authUserId: string;
    roles: string[];
    status: string;
    activeRole: Role | null;
  };
};

type SwitchResponse = {
  data: {
    roles: string[];
    activeRole: Role;
    profile: Profile;
  };
};

type BecomeProviderResponse = {
  data: {
    roles: string[];
    activeRole: 'provider';
    profileId: string;
  };
};

export type ProviderCategoryRow = {
  category_id: string;
  is_primary: boolean;
  categories: { id: string; name: string } | null;
};

/** Upserts application user + CUSTOMER role after auth/profile creation. */
export async function syncIdentity(fullName?: string, phone?: string) {
  if (!isApiConfigured()) return null;
  return apiFetch<MeResponse>('/api/v1/auth/sync', {
    method: 'POST',
    body: JSON.stringify({ fullName, phone }),
  });
}

export async function fetchIdentityMe() {
  if (!isApiConfigured()) return null;
  return apiFetch<MeResponse>('/api/v1/auth/me');
}

/** Grants PROVIDER role server-side and sets offered services. */
export async function becomeProvider(
  category?: string,
  skillIds?: string[],
  categoryIds?: string[],
) {
  if (!isApiConfigured()) return null;
  return apiFetch<BecomeProviderResponse>('/api/v1/auth/become-provider', {
    method: 'POST',
    body: JSON.stringify({ category, skillIds, categoryIds }),
  });
}

export async function setMyProviderCategories(categoryIds: string[]) {
  if (!isApiConfigured()) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) throw new Error('Not signed in');
    const { error } = await supabase.rpc('replace_provider_categories', {
      p_provider_id: uid,
      p_category_ids: categoryIds,
    });
    if (error) throw error;
    await supabase.rpc('sync_provider_opportunities', { p_provider_id: uid });
    return { data: categoryIds };
  }
  return apiFetch<{ data: unknown; meta: { label?: string } }>('/api/v1/providers/me/categories', {
    method: 'PUT',
    body: JSON.stringify({ categoryIds }),
  });
}

export async function fetchProviderCategories(providerId: string): Promise<ProviderCategoryRow[]> {
  if (isApiConfigured()) {
    const res = await apiFetch<{ data: ProviderCategoryRow[] }>(
      `/api/v1/providers/${providerId}/categories`,
    );
    return res.data ?? [];
  }
  const { data, error } = await supabase
    .from('provider_categories')
    .select('category_id, is_primary, categories(id, name)')
    .eq('provider_id', providerId);
  if (error) throw error;
  return (data as ProviderCategoryRow[]) ?? [];
}

/** Switches active UX mode when the account already holds that role. */
export async function switchActiveRole(role: Role) {
  if (!isApiConfigured()) return null;
  return apiFetch<SwitchResponse>('/api/v1/auth/switch-role', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}
