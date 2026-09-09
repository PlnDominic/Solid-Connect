import { apiFetch, isApiConfigured } from '../lib/api';
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

/** Grants PROVIDER role server-side and sets active mode to provider. */
export async function becomeProvider(category?: string, skillIds?: string[]) {
  if (!isApiConfigured()) return null;
  return apiFetch<BecomeProviderResponse>('/api/v1/auth/become-provider', {
    method: 'POST',
    body: JSON.stringify({ category, skillIds }),
  });
}

/** Switches active UX mode when the account already holds that role. */
export async function switchActiveRole(role: Role) {
  if (!isApiConfigured()) return null;
  return apiFetch<SwitchResponse>('/api/v1/auth/switch-role', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}
