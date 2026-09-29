import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { syncJobReminders } from '../lib/jobReminders';
import { useSessionStore } from '../store/useSessionStore';
import type { Job } from '../types/database';

/**
 * Renders nothing. Keeps this phone's 24h / 1h appointment reminders in
 * step with the signed-in user's upcoming jobs, whichever side of the job
 * they're on. Polls every few minutes rather than using Realtime so it can
 * never clash with the Jobs screens' own channels.
 */
export function JobReminderSync() {
  const userId = useSessionStore((s) => s.profile?.id ?? null);

  const { data: jobs } = useQuery({
    queryKey: ['jobReminderJobs', userId],
    enabled: !!userId,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'accepted')
        .not('scheduled_for', 'is', null)
        .or(`customer_id.eq.${userId},provider_id.eq.${userId}`);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (jobs) void syncJobReminders(jobs);
  }, [jobs]);

  return null;
}
