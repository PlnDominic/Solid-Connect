import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { CustomerReview, Profile, Review } from '../types/database';

export interface ProviderReview extends Review {
  customer: Pick<Profile, 'full_name' | 'initials'> | null;
}

/** The review left for a specific job, if any — tells us whether a completed job still needs rating. */
export function useJobReview(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['review', 'job', jobId],
    queryFn: async (): Promise<Review | null> => {
      const { data, error } = await supabase.from('reviews').select('*').eq('job_id', jobId as string).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
}

/** Every job id this customer has already reviewed - lets the Jobs list
 * mark completed-but-unrated jobs with one query instead of one
 * useJobReview per row. */
export function useCustomerReviewedJobIds(customerId: string | null) {
  return useQuery({
    queryKey: ['reviewedJobIds', 'customer', customerId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('reviews').select('job_id').eq('customer_id', customerId as string);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.job_id as string));
    },
    enabled: !!customerId,
  });
}

/** A provider's reviews, newest first, with the customer's display name. */
export function useProviderReviews(providerId: string | null) {
  return useQuery({
    queryKey: ['reviews', 'provider', providerId],
    queryFn: async (): Promise<ProviderReview[]> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id,job_id,provider_id,customer_id,rating,comment,created_at,profiles!reviews_customer_id_fkey(full_name,initials)')
        .eq('provider_id', providerId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({ ...row, customer: row.profiles })) as ProviderReview[];
    },
    enabled: !!providerId,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; providerId: string; customerId: string; rating: number; comment?: string }) => {
      if (isApiConfigured()) {
        await apiFetch('/api/v1/reviews', {
          method: 'POST',
          body: JSON.stringify({
            jobId: input.jobId,
            rating: input.rating,
            comment: input.comment?.trim() || undefined,
          }),
        });
        return;
      }
      const { error } = await supabase.from('reviews').insert({
        job_id: input.jobId,
        provider_id: input.providerId,
        customer_id: input.customerId,
        rating: input.rating,
        comment: input.comment?.trim() ? input.comment.trim() : null,
      });
      if (error) throw error;
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['review', 'job', input.jobId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', 'provider', input.providerId] });
      queryClient.invalidateQueries({ queryKey: ['provider', input.providerId] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['job', input.jobId] });
      queryClient.invalidateQueries({ queryKey: ['activeJob', 'customer', input.customerId] });
    },
  });
}

// ── two-sided reviews: provider rates the customer ─────────────────────
// Mirrors the hooks above but against customer_reviews (0062) — one row
// per job, written by the provider, feeding profiles.customer_rating via
// the apply_customer_review() trigger.

/** The customer review a provider left on a specific job, if any — gates the
 * "Rate customer" CTA the same way useJobReview gates the customer's. */
export function useJobCustomerReview(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['customerReview', 'job', jobId],
    queryFn: async (): Promise<CustomerReview | null> => {
      const { data, error } = await supabase
        .from('customer_reviews')
        .select('*')
        .eq('job_id', jobId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
}

/** Every job id this provider has already rated the customer on - one
 * query instead of one useJobCustomerReview per row on the Jobs list. */
export function useProviderReviewedJobIds(providerId: string | null) {
  return useQuery({
    queryKey: ['reviewedJobIds', 'provider', providerId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('customer_reviews')
        .select('job_id')
        .eq('provider_id', providerId as string);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.job_id as string));
    },
    enabled: !!providerId,
  });
}

/** A customer's reviews (left by providers), newest first, with the
 * provider author's display name - the mirror of useProviderReviews. */
export function useCustomerReviews(customerId: string | null) {
  return useQuery({
    queryKey: ['customerReviews', 'customer', customerId],
    queryFn: async (): Promise<Array<CustomerReview & { provider: Pick<Profile, 'full_name' | 'initials'> | null }>> => {
      const { data, error } = await supabase
        .from('customer_reviews')
        .select('id,job_id,provider_id,customer_id,rating,comment,created_at,profiles!customer_reviews_provider_id_fkey(full_name,initials)')
        .eq('customer_id', customerId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({ ...row, provider: row.profiles }));
    },
    enabled: !!customerId,
  });
}

export function useSubmitCustomerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; providerId: string; customerId: string; rating: number; comment?: string }) => {
      if (isApiConfigured()) {
        await apiFetch('/api/v1/customer-reviews', {
          method: 'POST',
          body: JSON.stringify({
            jobId: input.jobId,
            rating: input.rating,
            comment: input.comment?.trim() || undefined,
          }),
        });
        return;
      }
      const { error } = await supabase.from('customer_reviews').insert({
        job_id: input.jobId,
        provider_id: input.providerId,
        customer_id: input.customerId,
        rating: input.rating,
        comment: input.comment?.trim() ? input.comment.trim() : null,
      });
      if (error) throw error;
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ['customerReview', 'job', input.jobId] });
      queryClient.invalidateQueries({ queryKey: ['reviewedJobIds', 'provider', input.providerId] });
      queryClient.invalidateQueries({ queryKey: ['customerReviews', 'customer', input.customerId] });
      queryClient.invalidateQueries({ queryKey: ['provider', input.customerId] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['job', input.jobId] });
    },
  });
}
