import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { useRealtimeInvalidate } from '../hooks/useRealtimeInvalidate';
import { supabase } from '../lib/supabase';
import type { Job, Payment } from '../types/database';

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

      // One transaction in the database: accept this quote, decline the
      // others, create the job, its pending payment and chat thread.
      // Doing these as separate client writes could strand a request as
      // "accepted" with no job if a later step failed (e.g. a double booking).
      const { data, error } = await supabase.rpc('accept_quote', {
        p_quote_id: input.quoteId,
        p_customer_id: input.customerId,
      });
      if (error) throw error;
      return (data as { job: Job }).job;
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

/** Every job this customer has ever had, newest first - the customer's
 * side of what useProviderJobs already gives providers. useCustomerActiveJob
 * stays as-is for screens that only care about the single most recent job. */
export function useCustomerJobs(customerId: string | null) {
  const query = useQuery({
    queryKey: ['jobs', 'customer', customerId],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', customerId as string)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!customerId,
  });

  useRealtimeInvalidate({
    channel: `jobs_customer:${customerId}`,
    table: 'jobs',
    filter: customerId ? `customer_id=eq.${customerId}` : undefined,
    queryKeys: [['jobs', 'customer', customerId]],
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

/** Provider check-ins before work starts: "on my way" then "arrived".
 * Both go straight to Supabase RPCs (no separate-API route exists for them). */
export function useJobCheckIn(kind: 'en_route' | 'arrived') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: Job) => {
      const { data, error } = await supabase.rpc(kind === 'en_route' ? 'mark_en_route' : 'mark_arrived', {
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
      const { data, error } = await supabase.rpc('confirm_job_completion', {
        p_job_id: job.id,
        p_customer_id: job.customer_id,
      });
      if (error) throw error;
      return (data as { payment: Payment }).payment;
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

/** The one payment row tied to a job - the pending/released amount shown
 * on the job receipt/invoice. Payments are inserted alongside the job
 * itself (see useAcceptQuote) so this is always exactly one row. */
export function usePayment(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['payment', jobId],
    queryFn: async (): Promise<Payment | null> => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('job_id', jobId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
}

