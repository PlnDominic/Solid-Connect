import { useEffect } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import type { Job, JobStatus } from '../types/database';

const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];

/**
 * Reports the signed-in user's foreground position to report_job_location
 * while `job` is in one of the active statuses, throttled to roughly every
 * 10s or every ~30m moved (iOS only honors the distance filter - timeInterval
 * is Android-only per Expo's Location API, so distanceInterval is what
 * actually bounds iOS update frequency).
 *
 * No-ops entirely (and stops any running watch) as soon as `job` is null or
 * leaves the active window - pass a live, realtime-updated Job (e.g. from
 * useJob/useCustomerActiveJob/useProviderJobs) so a job completing
 * elsewhere stops this automatically, without this hook needing to poll
 * for that itself.
 *
 * Permission denial is a silent no-op: the rest of the job flow is
 * unaffected, and there is no retry loop or blocking UI here. The calling
 * screen owns any one-time disclosure copy shown before the OS prompt.
 */
export function useReportJobLocation(job: Job | null | undefined) {
  const jobId = job?.id;
  const isActive = !!job && ACTIVE_JOB_STATUSES.includes(job.status);

  useEffect(() => {
    if (!isActive || !jobId) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10_000,
          distanceInterval: 30,
        },
        (position) => {
          supabase
            .rpc('report_job_location', {
              p_job_id: jobId,
              p_lat: position.coords.latitude,
              p_lng: position.coords.longitude,
            })
            .then(({ error }) => {
              if (error) console.warn('[useReportJobLocation] report failed:', error.message);
            });
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [isActive, jobId]);
}
