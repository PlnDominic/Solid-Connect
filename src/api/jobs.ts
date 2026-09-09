import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { useRealtimeInvalidate } from '../hooks/useRealtimeInvalidate';
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
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: { job: Job; quote: unknown } }>('/api/v1/quotes/accept', {
          method: 'POST',
          body: JSON.stringify({ quoteId: input.quoteId }),
        });
        return res.data.job as Job;
      }

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
          step: 1,
          status: 'accepted',
        })
        .select('*')
        .single();
      if (jErr) throw jErr;

      await supabase.from('payments').insert({ job_id: job.id, amount: quote.price, status: 'pending' });
      await supabase
        .from('chat_threads')
        .upsert(
          { request_id: input.requestId, provider_id: quote.provider_id, customer_id: input.customerId, job_id: job.id },
          { onConflict: 'request_id,provider_id' },
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
  const query = useQuery({
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

  useRealtimeInvalidate({
    channel: `active_job_customer:${customerId}`,
    table: 'jobs',
    filter: customerId ? `customer_id=eq.${customerId}` : undefined,
    queryKeys: [['activeJob', 'customer', customerId]],
    enabled: !!customerId,
  });

  return query;
}

export function useProviderJobs(providerId: string | null) {
  const query = useQuery({
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

  useRealtimeInvalidate({
    channel: `provider_jobs:${providerId}`,
    table: 'jobs',
    filter: providerId ? `provider_id=eq.${providerId}` : undefined,
    queryKeys: [['jobs', 'provider', providerId]],
    enabled: !!providerId,
  });

  return query;
}

/** A single job by id - shared by the customer's and the provider's Job
 * Detail screens, so realtime here is what makes "provider starts/finishes
 * work" and "customer confirms completion" show up live on the other
 * person's screen. */
export function useJob(jobId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: async (): Promise<Job | null> => {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId as string).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });

  useRealtimeInvalidate({
    channel: `job:${jobId}`,
    table: 'jobs',
    filter: jobId ? `id=eq.${jobId}` : undefined,
    queryKeys: [['job', jobId]],
    enabled: !!jobId,
  });

  return query;
}

export function useStartJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: Job }>(`/api/v1/jobs/${job.id}/start`, { method: 'POST' });
        return res.data;
      }
      const { data, error } = await supabase.rpc('start_job', {
        p_job_id: job.id,
        p_provider_id: job.provider_id,
      });
      if (error) throw error;
      return data as Job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'provider', job.provider_id] });
      queryClient.invalidateQueries({ queryKey: ['activeJob', 'customer', job.customer_id] });
    },
  });
}

export function useFinishJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: Job }>(`/api/v1/jobs/${job.id}/finish`, { method: 'POST' });
        return res.data;
      }
      const { data, error } = await supabase.rpc('finish_job', {
        p_job_id: job.id,
        p_provider_id: job.provider_id,
      });
      if (error) throw error;
      return data as Job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'provider', job.provider_id] });
      queryClient.invalidateQueries({ queryKey: ['activeJob', 'customer', job.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useAdvanceJobStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: Job }>(`/api/v1/jobs/${job.id}/advance`, { method: 'POST' });
        return res.data;
      }
      const { data, error } = await supabase.rpc('advance_job', {
        p_job_id: job.id,
        p_provider_id: job.provider_id,
      });
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
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: { job: Job; payment: Payment } }>(`/api/v1/jobs/${job.id}/confirm`, {
          method: 'POST',
        });
        return res.data.payment;
      }
      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          step: 5,
          completed_at: new Date().toISOString(),
          customer_confirmed_at: new Date().toISOString(),
        })
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
      queryClient.invalidateQueries({ queryKey: ['myActiveRequest', job.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCustomerJobsCount(customerId: string | null) {
  return useQuery({
    queryKey: ['jobsCount', 'customer', customerId],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId as string);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!customerId,
  });
}

export function useProviderEarningsThisMonth(providerId: string | null) {
  return useQuery({
    queryKey: ['earnings', 'thisMonth', providerId],
    queryFn: async (): Promise<number> => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data: myJobs, error: jErr } = await supabase
        .from('jobs')
        .select('id')
        .eq('provider_id', providerId as string);
      if (jErr) throw jErr;
      const jobIds = (myJobs ?? []).map((j) => j.id);
      if (!jobIds.length) return 0;
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'released')
        .gte('released_at', monthStart.toISOString())
        .in('job_id', jobIds);
      if (error) throw error;
      return (data ?? []).reduce((sum, p) => sum + p.amount, 0);
    },
    enabled: !!providerId,
  });
}

