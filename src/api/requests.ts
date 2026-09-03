import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Quote, ServiceRequest } from '../types/database';

export interface RequestWithQuotes extends ServiceRequest {
  quotes: Quote[];
}

const SEED_QUOTES = [
  { provider_id: '22222222-2222-4222-8222-222222222222', price: 480, eta_label: 'Today, 2 hrs', badge_label: '★ Certified', badge_kind: 'certified' as const },
  { provider_id: '11111111-1111-4111-8111-111111111111', price: 520, eta_label: 'Tomorrow', badge_label: '✓ Identity verified', badge_kind: 'verified' as const },
  { provider_id: '44444444-4444-4444-8444-444444444444', price: 390, eta_label: 'Today, 5 hrs', badge_label: '✓ Identity verified', badge_kind: 'verified' as const },
];

/** The customer's single current/most-recent request, with its quotes. */
export function useMyActiveRequest(customerId: string | null) {
  return useQuery({
    queryKey: ['myActiveRequest', customerId],
    queryFn: async (): Promise<RequestWithQuotes | null> => {
      const { data: request, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('customer_id', customerId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!request) return null;
      const { data: quotes, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('request_id', request.id)
        .order('price', { ascending: true });
      if (qErr) throw qErr;
      return { ...request, quotes: quotes ?? [] };
    },
    enabled: !!customerId,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customerId: string;
      categoryId: string;
      categoryLabel: string;
      description: string;
      budgetMin: number;
      budgetMax: number;
      locationLabel: string;
    }) => {
      const { data, error } = await supabase
        .from('service_requests')
        .insert({
          customer_id: input.customerId,
          category_id: input.categoryId,
          category_label: input.categoryLabel,
          description: input.description,
          budget_min: input.budgetMin,
          budget_max: input.budgetMax,
          location_label: input.locationLabel,
          status: 'matching',
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as ServiceRequest;
    },
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest', request.customer_id] });
    },
  });
}

/** Mirrors the prototype's "Skip ahead: 3 quotes just came in" demo button. */
export function useSimulateQuotesArriving() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const rows = SEED_QUOTES.map((q) => ({ request_id: requestId, ...q }));
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
      const { data, error } = await supabase.from('service_requests').select('*').eq('id', requestId as string).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });
}

/** Provider feed: open requests from other customers, with whether I've quoted. */
export function useFeedRequests(myProviderId: string | null) {
  return useQuery({
    queryKey: ['feedRequests', myProviderId],
    queryFn: async (): Promise<(ServiceRequest & { myQuote: Quote | null })[]> => {
      const { data: requests, error } = await supabase
        .from('service_requests')
        .select('*')
        .in('status', ['open', 'matching', 'quoted'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      if (!requests?.length) return [];
      const { data: myQuotes, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('provider_id', myProviderId as string)
        .in('request_id', requests.map((r) => r.id));
      if (qErr) throw qErr;
      const byRequest = new Map((myQuotes ?? []).map((q) => [q.request_id, q]));
      return requests.map((r) => ({ ...r, myQuote: byRequest.get(r.id) ?? null }));
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
    }) => {
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
      return data as Quote;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['feedRequests', vars.providerId] });
    },
  });
}
