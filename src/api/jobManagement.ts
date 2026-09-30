import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeInvalidate } from '../hooks/useRealtimeInvalidate';
import { supabase } from '../lib/supabase';
import type { Job, JobCancelReason, JobReschedule } from '../types/database';

const ERROR_COPY: Record<string, string> = {
  JOB_NOT_CANCELLABLE: 'This job can no longer be cancelled.',
  CANCEL_AFTER_START_USE_DISPUTE: 'Work has already started. Open a dispute if you need to stop this job.',
  NO_SHOW_TOO_EARLY: 'You can report a no-show 30 minutes after the scheduled time.',
  NO_SHOW_NOT_ALLOWED: 'A no-show can only be reported before work has started.',
  INVALID_REASON: 'Pick a valid reason.',
  JOB_ALREADY_STARTED: 'Work has already started, so the time can no longer be changed.',
  TIME_IN_PAST: 'Pick a time at least 15 minutes from now.',
  TIME_TOO_FAR: 'Pick a time within the next 90 days.',
  RESCHEDULE_NOT_PENDING: 'That proposal was already answered or replaced.',
  CANNOT_ANSWER_OWN_PROPOSAL: 'The other person needs to answer your proposal.',
  FORBIDDEN: 'You are not part of this job.',
  SLOT_TAKEN: 'The provider already has a job around that time. Pick another time.',
};

/** Turns a Postgres error raised by the job-management functions into a
 * sentence a person can act on. */
export function friendlyJobError(err: unknown): string {
  const message = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  const code = Object.keys(ERROR_COPY).find((c) => message.includes(c));
  return code ? ERROR_COPY[code] : 'Something went wrong. Please try again.';
}

export function useJobReschedules(jobId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['jobReschedules', jobId],
    queryFn: async (): Promise<JobReschedule[]> => {
      const { data, error } = await supabase
        .from('job_reschedules')
        .select('*')
        .eq('job_id', jobId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobReschedule[];
    },
    enabled: !!jobId,
  });

  useRealtimeInvalidate({
    channel: `job-reschedules:${jobId}`,
    table: 'job_reschedules',
    filter: jobId ? `job_id=eq.${jobId}` : undefined,
    queryKeys: [['jobReschedules', jobId], ['job', jobId]],
    enabled: !!jobId,
  });

  return query;
}

function useInvalidateJob() {
  const queryClient = useQueryClient();
  return (jobId: string) => {
    queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    queryClient.invalidateQueries({ queryKey: ['jobReschedules', jobId] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['activeJob'] });
    queryClient.invalidateQueries({ queryKey: ['payment', jobId] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };
}

export function useCancelJob() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (input: { jobId: string; reason: JobCancelReason; note?: string }): Promise<Job> => {
      const { data, error } = await supabase.rpc('cancel_job', {
        p_job_id: input.jobId,
        p_reason: input.reason,
        p_note: input.note ?? '',
      });
      if (error) throw error;
      return data as Job;
    },
    onSuccess: (_job, input) => invalidate(input.jobId),
  });
}

export function useProposeReschedule() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (input: { jobId: string; proposedFor: Date; note?: string }): Promise<JobReschedule> => {
      const { data, error } = await supabase.rpc('propose_reschedule', {
        p_job_id: input.jobId,
        p_proposed_for: input.proposedFor.toISOString(),
        p_note: input.note ?? '',
      });
      if (error) throw error;
      return data as JobReschedule;
    },
    onSuccess: (_r, input) => invalidate(input.jobId),
  });
}

export function useRespondReschedule() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (input: { jobId: string; rescheduleId: string; accept: boolean }): Promise<JobReschedule> => {
      const { data, error } = await supabase.rpc('respond_reschedule', {
        p_reschedule_id: input.rescheduleId,
        p_accept: input.accept,
      });
      if (error) throw error;
      return data as JobReschedule;
    },
    onSuccess: (_r, input) => invalidate(input.jobId),
  });
}
