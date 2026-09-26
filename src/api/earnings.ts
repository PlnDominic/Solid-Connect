import { useQuery } from '@tanstack/react-query';
import { summarizePayouts, type PayoutRow } from '../lib/earnings';
import { supabase } from '../lib/supabase';

export { summarizePayouts };
export type { EarningsSummary, PayoutRow, PayoutStatus } from '../lib/earnings';

type RawPayout = Omit<PayoutRow, 'job_title'> & {
  payments: { jobs: { title: string | null } | { title: string | null }[] | null } | null;
};

export function useProviderPayouts(providerId: string | null | undefined) {
  return useQuery({
    queryKey: ['payouts', providerId],
    queryFn: async (): Promise<PayoutRow[]> => {
      const { data, error } = await supabase
        .from('provider_payouts')
        .select(
          'id, gross_amount, commission_amount, net_amount, status, payout_method, payout_reference, paid_at, created_at, payments(jobs(title))',
        )
        .eq('provider_id', providerId as string)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as RawPayout[]).map(({ payments, ...row }) => {
        const job = Array.isArray(payments?.jobs) ? payments?.jobs[0] : payments?.jobs;
        return { ...row, job_title: job?.title ?? null };
      });
    },
    enabled: !!providerId,
  });
}
