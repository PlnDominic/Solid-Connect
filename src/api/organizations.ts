import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { supabase } from '../lib/supabase';

export type Organization = {
  id: string;
  name: string;
  description?: string;
  phone?: string | null;
  email?: string | null;
  area?: string | null;
  status: string;
  owner_id: string;
  myRole?: string;
  created_at: string;
};

export type OrgProject = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  location_label: string;
  status: string;
  created_at: string;
};

export type OrgMember = {
  profile_id: string;
  role: string;
  created_at: string;
  profiles?: { id: string; full_name: string | null; email: string | null } | null;
};

export type OrgDetail = Organization & {
  members: OrgMember[];
  projects: OrgProject[];
  recurring: Array<{
    id: string;
    category_label: string;
    cadence: string;
    next_run_at: string;
    active: boolean;
    budget: number;
    location_label: string;
  }>;
};

export function useMyOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      if (!isApiConfigured()) return [] as Organization[];
      const res = await apiFetch<{ data: Organization[] }>('/api/v1/organizations');
      return res.data ?? [];
    },
  });
}

export function useOrganization(orgId: string | null) {
  return useQuery({
    queryKey: ['organization', orgId],
    enabled: !!orgId && isApiConfigured(),
    queryFn: async () => {
      const res = await apiFetch<{ data: OrgDetail }>(`/api/v1/organizations/${orgId}`);
      return res.data;
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; area?: string; phone?: string }) => {
      if (!isApiConfigured()) throw new Error('API is required to create an organization.');
      const res = await apiFetch<{ data: Organization }>('/api/v1/organizations', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export function useCreateProject(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; locationLabel?: string }) => {
      const res = await apiFetch<{ data: OrgProject }>(`/api/v1/organizations/${orgId}/projects`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
    },
  });
}

export function useCreateWorkforceRequest(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      categoryLabel: string;
      description: string;
      locationLabel: string;
      budget: number;
      projectId?: string;
    }) => {
      const res = await apiFetch(`/api/v1/organizations/${orgId}/requests`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useAddOrgMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { profileId: string; role?: 'admin' | 'member' }) => {
      const res = await apiFetch(`/api/v1/organizations/${orgId}/members`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
    },
  });
}

export function useCreateRecurringService(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      categoryLabel: string;
      description: string;
      locationLabel: string;
      budget: number;
      cadence: 'weekly' | 'biweekly' | 'monthly';
      projectId?: string;
    }) => {
      const res = await apiFetch(`/api/v1/organizations/${orgId}/recurring`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
    },
  });
}

/** Look up a profile id by email for invites (service-role not available on device). */
export async function findProfileIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('id').ilike('email', email.trim()).maybeSingle();
  return data?.id ?? null;
}
