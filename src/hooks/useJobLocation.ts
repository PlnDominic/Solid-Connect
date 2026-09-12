import { useQuery } from '@tanstack/react-query';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { supabase } from '../lib/supabase';
import type { JobLocation } from '../types/database';

/**
 * Reads the other party's (and my own last-reported) live position for a
 * job, kept fresh via Realtime - the read side of the job-live-location
 * foundation (see useReportJobLocation for the write side). Returns null
 * while nobody has reported yet, which is a normal state, not an error.
 */
export function useJobLocation(jobId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['jobLocation', jobId],
    queryFn: async (): Promise<JobLocation | null> => {
      const { data, error } = await supabase.from('job_locations').select('*').eq('job_id', jobId as string).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
    // Realtime covers the common case; this is just a safety net for a
    // missed event (e.g. a brief reconnect) so "updated Ns ago" doesn't
    // silently stall.
    refetchInterval: 15_000,
  });

  useRealtimeInvalidate({
    channel: `jobLocation:${jobId}`,
    table: 'job_locations',
    filter: jobId ? `job_id=eq.${jobId}` : undefined,
    queryKeys: [['jobLocation', jobId]],
    enabled: !!jobId,
  });

  return query;
}
