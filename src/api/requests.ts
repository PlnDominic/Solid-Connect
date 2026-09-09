import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Quote, ServiceRequest } from '../types/database';

export interface RequestWithQuotes extends ServiceRequest {
  quotes: Quote[];
}

export type FeedItem = ServiceRequest & {
  myQuote: Quote | null;
  matchScore?: number;
  distanceMeters?: number | null;
};

const SEED_QUOTES = [
  { provider_id: '22222222-2222-4222-8222-222222222222', price: 480, eta_label: 'Today, 2 hrs', badge_label: 'Certified', badge_kind: 'certified' as const },
  { provider_id: '11111111-1111-4111-8111-111111111111', price: 520, eta_label: 'Tomorrow', badge_label: 'Identity verified', badge_kind: 'verified' as const },
  { provider_id: '44444444-4444-4444-8444-444444444444', price: 390, eta_label: 'Today, 5 hrs', badge_label: 'Identity verified', badge_kind: 'verified' as const },
];

/** Open request statuses that belong on the customer Requests feed. */
const ACTIVE_REQUEST_STATUSES = [
  'open',
  'matching',
  'quoted',
  'awaiting_provider',
  'rejected',
] as const;

/** The customer's current open request (excludes accepted/completed jobs). */
export function useMyActiveRequest(customerId: string | null) {
  return useQuery({
    queryKey: ['myActiveRequest', customerId],
    queryFn: async (): Promise<RequestWithQuotes | null> => {
      const { data: request, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('customer_id', customerId as string)
        .in('status', [...ACTIVE_REQUEST_STATUSES])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!request) return null;
      const { data: quotes, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('request_id', request.id)
        .eq('status', 'sent')
        .order('price', { ascending: true });
      if (qErr) throw qErr;
      return { ...request, quotes: quotes ?? [] };
    },
    enabled: !!customerId,
  });
}

async function uploadRequestPhoto(customerId: string, imageUri: string): Promise<string> {
  const response = await fetch(imageUri);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${customerId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('request-photos')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;
  const { data: publicUrl } = supabase.storage.from('request-photos').getPublicUrl(path);
  return publicUrl.publicUrl;
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customerId: string;
      categoryId: string;
      categoryLabel: string;
      description: string;
      budget: number;
      locationLabel: string;
      photoUris?: string[];
      preferredProviderId?: string;
    }) => {
      const photos: string[] = [];
      for (const uri of input.photoUris ?? []) {
        photos.push(await uploadRequestPhoto(input.customerId, uri));
      }

      if (isApiConfigured()) {
        const res = await apiFetch<{
          data: { request: ServiceRequest; matchedCount: number };
          meta: { matchedCount: number };
        }>('/api/v1/requests', {
          method: 'POST',
          body: JSON.stringify({
            categoryId: input.categoryId,
            categoryLabel: input.categoryLabel,
            description: input.description,
            photos,
            budget: input.budget,
            budgetMin: input.budget,
            budgetMax: input.budget,
            locationLabel: input.locationLabel,
            ...(input.preferredProviderId
              ? { preferredProviderId: input.preferredProviderId }
              : {}),
          }),
        });
        return {
          ...res.data.request,
          matchedCount: res.meta.matchedCount ?? res.data.matchedCount,
        };
      }

      const isDirect = Boolean(input.preferredProviderId);
      const { data, error } = await supabase
        .from('service_requests')
        .insert({
          customer_id: input.customerId,
          category_id: input.categoryId,
          category_label: input.categoryLabel,
          description: input.description,
          photos,
          budget_min: input.budget,
          budget_max: input.budget,
          customer_budget: input.budget,
          location_label: input.locationLabel,
          preferred_provider_id: input.preferredProviderId ?? null,
          request_mode: isDirect ? 'DIRECT' : 'GENERAL',
          status: isDirect ? 'awaiting_provider' : 'matching',
        })
        .select('*')
        .single();
      if (error) throw error;

      if (input.preferredProviderId) {
        await supabase.from('request_opportunities').insert({
          request_id: data.id,
          provider_id: input.preferredProviderId,
          score: 100,
          status: 'NOTIFIED',
        });
      }

      return { ...(data as ServiceRequest), matchedCount: input.preferredProviderId ? 1 : 0 };
    },
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest', request.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['feedRequests'] });
    },
  });
}

export function useRequestOpportunities(requestId: string | null) {
  return useQuery({
    queryKey: ['requestOpportunities', requestId],
    enabled: !!requestId && isApiConfigured(),
    queryFn: async () => {
      const res = await apiFetch<{ data: unknown[]; meta: { count: number } }>(
        `/api/v1/requests/${requestId}/opportunities`,
      );
      return { items: res.data, count: res.meta.count ?? res.data.length };
    },
  });
}

/**
 * Prefers Nest quote create for matched/demo providers when API configured;
 * else inserts quotes client-side for empty-market demos.
 */
export function useSimulateQuotesArriving() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data: request, error: reqErr } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (reqErr) throw reqErr;

      // Direct request: only the preferred provider may "reply"
      if (request.preferred_provider_id) {
        const { data: provider } = await supabase
          .from('profiles')
          .select('id, provider_certified')
          .eq('id', request.preferred_provider_id)
          .maybeSingle();
        if (!provider) throw new Error('Preferred provider not found');
        const { error: insertErr } = await supabase.from('quotes').insert({
          request_id: requestId,
          provider_id: provider.id,
          price: Math.max(150, request.budget_min ?? 300),
          eta_label: 'Today, 2 hrs',
          badge_label: provider.provider_certified ? 'Certified' : 'Identity verified',
          badge_kind: provider.provider_certified ? 'certified' : 'verified',
        });
        if (insertErr) throw insertErr;
        await supabase
          .from('request_opportunities')
          .update({ status: 'QUOTED' })
          .eq('request_id', requestId)
          .eq('provider_id', provider.id);
        const { error: updateErr } = await supabase
          .from('service_requests')
          .update({ status: 'quoted' })
          .eq('id', requestId);
        if (updateErr) throw updateErr;
        return;
      }

      const trade = (request.category_label.split('·')[0] ?? '').trim().toLowerCase();
      const areaNeedle = (request.location_label ?? '').split(',')[0]?.trim().toLowerCase() ?? '';

      const { data: providers, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'provider')
        .eq('provider_verified', true)
        .order('provider_rating', { ascending: false })
        .limit(20);
      if (pErr) throw pErr;

      const ranked = (providers ?? [])
        .map((p) => {
          const cat = (p.provider_category ?? '').toLowerCase();
          const area = (p.area ?? '').toLowerCase();
          const parts = cat.split('·').map((t) => t.trim()).filter(Boolean);
          let score = p.provider_rating * 10;
          if (trade && (parts.some((t) => t.includes(trade) || trade.includes(t)) || cat.includes(trade))) {
            score += 30;
          }
          if (areaNeedle && area.includes(areaNeedle)) score += 20;
          if (p.provider_certified) score += 5;
          if (p.provider_distance_km != null) score += Math.max(0, 10 - p.provider_distance_km);
          return { p, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const rows =
        ranked.length > 0
          ? ranked.map(({ p }, i) => ({
              request_id: requestId,
              provider_id: p.id,
              price: Math.max(150, (request.budget_min ?? 300) + i * 40),
              eta_label: i === 0 ? 'Today, 2 hrs' : i === 1 ? 'Today, 5 hrs' : 'Tomorrow',
              badge_label: p.provider_certified ? 'Certified' : 'Identity verified',
              badge_kind: (p.provider_certified ? 'certified' : 'verified') as 'certified' | 'verified',
            }))
          : SEED_QUOTES.map((q) => ({ request_id: requestId, ...q }));

      // Demo helper still inserts via Supabase (service uses seed IDs / multi-provider).
      // Production quoting goes through Nest POST /quotes from RequestDetailScreen.
      const { error: insertErr } = await supabase.from('quotes').insert(rows);
      if (insertErr) throw insertErr;
      const { error: updateErr } = await supabase
        .from('service_requests')
        .update({ status: 'quoted' })
        .eq('id', requestId);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest'] });
    },
  });
}

export function useServiceRequest(requestId: string | null | undefined) {
  return useQuery({
    queryKey: ['serviceRequest', requestId],
    queryFn: async (): Promise<ServiceRequest | null> => {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', requestId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });
}

/** Provider feed: Nest opportunities when API configured; else legacy open-request list. */
export function useFeedRequests(myProviderId: string | null) {
  return useQuery({
    queryKey: ['feedRequests', myProviderId, isApiConfigured()],
    queryFn: async (): Promise<FeedItem[]> => {
      if (isApiConfigured()) {
        const res = await apiFetch<{
          data: Array<{
            score: number;
            distance_meters: number | null;
            myQuote: Quote | null;
            request: ServiceRequest | null;
          }>;
        }>('/api/v1/feed/opportunities');
        return (res.data ?? [])
          .filter((row) => row.request)
          .map((row) => ({
            ...(row.request as ServiceRequest),
            myQuote: row.myQuote,
            matchScore: row.score,
            distanceMeters: row.distance_meters,
          }));
      }

      const { data: me } = await supabase
        .from('profiles')
        .select('provider_category,area')
        .eq('id', myProviderId as string)
        .maybeSingle();

      const { data: requests, error } = await supabase
        .from('service_requests')
        .select('*')
        .in('status', ['open', 'matching', 'quoted'])
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      if (!requests?.length) return [];
      const { data: myQuotes, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('provider_id', myProviderId as string)
        .in(
          'request_id',
          requests.map((r) => r.id),
        );
      if (qErr) throw qErr;
      const byRequest = new Map((myQuotes ?? []).map((q) => [q.request_id, q]));

      const trade = (me?.provider_category ?? '').toLowerCase();
      const areaNeedle = (me?.area ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
      const trades = trade
        .split('·')
        .map((t) => t.trim())
        .filter(Boolean);

      return requests
        .filter((r) => !r.preferred_provider_id || r.preferred_provider_id === myProviderId)
        .map((r) => ({ ...r, myQuote: byRequest.get(r.id) ?? null }))
        .sort((a, b) => {
          const score = (r: ServiceRequest) => {
            let s = 0;
            const label = (r.category_label ?? '').toLowerCase();
            const loc = (r.location_label ?? '').toLowerCase();
            if (trades.length && trades.some((t) => label.includes(t))) s += 30;
            else if (trade && label.includes(trade)) s += 30;
            if (areaNeedle && loc.includes(areaNeedle)) s += 20;
            s += new Date(r.created_at).getTime() / 1e12;
            return s;
          };
          return score(b) - score(a);
        })
        .slice(0, 20);
    },
    enabled: !!myProviderId,
  });
}

export function useSendQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      providerId: string;
      price: number;
      etaLabel: string;
      badgeLabel: string;
      badgeKind: 'certified' | 'verified';
      note?: string;
    }) => {
      if (isApiConfigured()) {
        return apiFetch<{ data: Quote }>('/api/v1/quotes', {
          method: 'POST',
          body: JSON.stringify({
            requestId: input.requestId,
            price: input.price,
            etaLabel: input.etaLabel,
            note: input.note,
          }),
        }).then((r) => r.data);
      }

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          request_id: input.requestId,
          provider_id: input.providerId,
          price: input.price,
          eta_label: input.etaLabel,
          badge_label: input.badgeLabel,
          badge_kind: input.badgeKind,
        })
        .select('*')
        .single();
      if (error) throw error;
      await supabase
        .from('service_requests')
        .update({ status: 'quoted' })
        .eq('id', input.requestId)
        .in('status', ['open', 'matching']);
      await supabase
        .from('request_opportunities')
        .update({ status: 'QUOTED' })
        .eq('request_id', input.requestId)
        .eq('provider_id', input.providerId);
      return data as Quote;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['feedRequests', vars.providerId] });
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest'] });
    },
  });
}

export function useAcceptDirectRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!isApiConfigured()) {
        const { data: session } = await supabase.auth.getSession();
        const providerId = session.session?.user?.id;
        if (!providerId) throw new Error('Not signed in');
        const { data, error } = await supabase.rpc('accept_direct_request', {
          p_request_id: requestId,
          p_provider_id: providerId,
        });
        if (error) throw error;
        return data;
      }
      return apiFetch<{ data: { job: { id: string } } }>(`/api/v1/requests/${requestId}/accept-direct`, {
        method: 'POST',
        body: '{}',
      }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedRequests'] });
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useRejectDirectRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requestId: string; reason: string }) => {
      if (!isApiConfigured()) {
        const { data: session } = await supabase.auth.getSession();
        const providerId = session.session?.user?.id;
        if (!providerId) throw new Error('Not signed in');
        const { data, error } = await supabase.rpc('reject_direct_request', {
          p_request_id: input.requestId,
          p_provider_id: providerId,
          p_reason: input.reason,
        });
        if (error) throw error;
        return data;
      }
      return apiFetch(`/api/v1/requests/${input.requestId}/reject-direct`, {
        method: 'POST',
        body: JSON.stringify({ reason: input.reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedRequests'] });
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useNotifications(userId: string | null) {
  return useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: import('../types/database').AppNotification[] }>(
          '/api/v1/requests/notifications',
        );
        return res.data ?? [];
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
}
