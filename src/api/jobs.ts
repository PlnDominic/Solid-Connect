import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Job, Payment } from '../types/database';

function jobTitleFromCategoryLabel(categoryLabel: string) {
  const parts = categoryLabel.split('·').map((p) => p.trim());
  return parts[1] ?? parts[0] ?? categoryLabel;
}

export function useAcceptQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requestId: string; quoteId: string; customerId: string }) => {
      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', input.quoteId)
        .single();
      if (qErr) throw qErr;
      const { data: request, error: rErr } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', input.requestId)
        .single();
      if (rErr) throw rErr;

      await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quote.id);
      await supabase
        .from('quotes')
        .update({ status: 'declined' })
        .eq('request_id', input.requestId)
        .neq('id', quote.id);
      await supabase.from('service_requests').update({ status: 'accepted' }).eq('id', input.requestId);

      const { data: job, error: jErr } = await supabase
        .from('jobs')
        .insert({
          request_id: input.requestId,
          quote_id: quote.id,
          customer_id: input.customerId,
          provider_id: quote.provider_id,
          title: jobTitleFromCategoryLabel(request.category_label),
          price: quote.price,
          location_label: request.location_label,
          step: 3,
          status: 'in_progress',
        })
        .select('*')
        .single();
      if (jErr) throw jErr;

      await supabase.from('payments').insert({ job_id: job.id, amount: quote.price, status: 'pending' });
      await supabase
        .from('chat_threads')
        .upsert(
          { request_id: input.requestId, provider_id: quote.provider_id, customer_id: input.customerId, job_id: job.id },
          { onConflict: 'request_id,provider_id' }
        );

      return job as Job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest', job.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['activeJob', 'customer', job.customer_id] });
    },
  });
}

/** The customer's current job (there's at most one active at a time in this MVP). */
export function useCustomerActiveJob(customerId: string | null) {
  return useQuery({
    queryKey: ['activeJob', 'customer', customerId],
    queryFn: async (): Promise<Job | null> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', customerId as string)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
}

export function useProviderJobs(providerId: string | null) {
  return useQuery({
    queryKey: ['jobs', 'provider', providerId],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('provider_id', providerId as string)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!providerId,
  });
}

export function useJob(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async (): Promise<Job | null> => {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId as string).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
}

export function useAdvanceJobStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      const step = Math.min(5, job.step + 1);
      const status = step >= 5 ? 'completed' : 'in_progress';
      const { data, error } = await supabase
        .from('jobs')
        .update({ step, status, completed_at: step >= 5 ? new Date().toISOString() : null })
        .eq('id', job.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as Job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'provider', job.provider_id] });
    },
  });
}

export function useConfirmCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      await supabase
        .from('jobs')
        .update({ status: 'completed', step: 5, completed_at: new Date().toISOString() })
        .eq('id', job.id);
      const { data: payment, error } = await supabase
        .from('payments')
        .update({ status: 'released', released_at: new Date().toISOString() })
        .eq('job_id', job.id)
        .select('*')
        .single();
      if (error) throw error;
      return payment as Payment;
    },
    onSuccess: (_payment, job) => {
      queryClient.invalidateQueries({ queryKey: ['activeJob', 'customer', job.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    },
  });
}

export function useSubmitReview() {
  return useMutation({
    mutationFn: async (input: { jobId: string; providerId: string; customerId: string; rating: number }) => {
      const { error } = await supabase.from('reviews').insert({
        job_id: input.jobId,
        provider_id: input.providerId,
        customer_id: input.customerId,
        rating: input.rating,
      });
      if (error) throw error;
    },
  });
}
