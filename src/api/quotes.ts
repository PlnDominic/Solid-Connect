import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRealtimeInvalidate } from '../hooks/useRealtimeInvalidate';
import { supabase } from '../lib/supabase';
import type { Quote } from '../types/database';

const ERROR_COPY: Record<string, string> = {
  QUOTE_NOT_OPEN: 'This quote is no longer open.',
  REQUEST_NOT_ACCEPTABLE: 'This request is no longer taking changes.',
  ITEMS_MISMATCH: 'The line items must add up to the price.',
  ITEMS_INVALID: 'Check the line items: each needs a name and a whole amount, up to 8.',
  INVALID_PRICE: 'Enter a valid price.',
  NOTE_TOO_LONG: 'Keep the note under 500 characters.',
  INVALID_COUNTER: 'Your offer must be lower than the quote, but no more than 50% below it.',
  COUNTER_PENDING: 'You already have a counter-offer waiting for a reply.',
  COUNTER_DECLINED: 'The provider declined your counter-offer. You can accept the quote or decline it.',
  NO_COUNTER: 'There is no counter-offer to answer.',
  FORBIDDEN: 'You are not part of this quote.',
};

export function friendlyQuoteError(err: unknown): string {
  const message =
    err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  const code = Object.keys(ERROR_COPY).find((c) => message.includes(c));
  return code ? ERROR_COPY[code] : 'Something went wrong. Please try again.';
}

/** Every screen showing quotes reads them from one of these caches. */
function refreshQuoteViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['myActiveRequest'] });
  queryClient.invalidateQueries({ queryKey: ['myQuote'] });
  queryClient.invalidateQueries({ queryKey: ['feedRequests'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

/** The signed-in provider's own quote on a request, kept live so a
 * customer's counter-offer shows up without reopening the screen. */
export function useMyQuote(requestId: string | null | undefined, providerId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['myQuote', requestId, providerId],
    queryFn: async (): Promise<Quote | null> => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('request_id', requestId as string)
        .eq('provider_id', providerId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId && !!providerId,
  });

  useRealtimeInvalidate({
    channel: `my_quote:${requestId}:${providerId}`,
    table: 'quotes',
    filter: requestId ? `request_id=eq.${requestId}` : undefined,
    queryKeys: [['myQuote', requestId, providerId]],
    enabled: !!requestId && !!providerId,
  });

  return query;
}

export function useReviseQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      quoteId: string;
      price: number;
      items: { label: string; amount: number }[];
      note: string;
      proposedStart: string | null;
      etaLabel: string;
    }) => {
      const { data, error } = await supabase.rpc('revise_quote', {
        p_quote_id: input.quoteId,
        p_price: input.price,
        p_items: input.items,
        p_note: input.note,
        p_proposed_start: input.proposedStart,
        p_eta_label: input.etaLabel,
      });
      if (error) throw error;
      return data as Quote;
    },
    onSuccess: () => refreshQuoteViews(queryClient),
  });
}

export function useCounterQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { quoteId: string; price: number; note: string }) => {
      const { data, error } = await supabase.rpc('counter_quote', {
        p_quote_id: input.quoteId,
        p_price: input.price,
        p_note: input.note,
      });
      if (error) throw error;
      return data as Quote;
    },
    onSuccess: () => refreshQuoteViews(queryClient),
  });
}

export function useRespondToCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { quoteId: string; accept: boolean }) => {
      const { data, error } = await supabase.rpc('respond_to_counter', {
        p_quote_id: input.quoteId,
        p_accept: input.accept,
      });
      if (error) throw error;
      return data as Quote;
    },
    onSuccess: () => refreshQuoteViews(queryClient),
  });
}

export function useDeclineQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { quoteId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('decline_quote', {
        p_quote_id: input.quoteId,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data as Quote;
    },
    onSuccess: () => refreshQuoteViews(queryClient),
  });
}
