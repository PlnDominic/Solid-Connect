import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile, Review } from '../types/database';

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
