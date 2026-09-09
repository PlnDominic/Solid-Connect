import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Dispute, DisputeReason } from '../types/database';

export function useJobDispute(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['dispute', 'job', jobId],
    queryFn: async (): Promise<Dispute | null> => {
      const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .eq('job_id', jobId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
}

export function useOpenDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      jobId: string;
      customerId: string;
      providerId: string;
      reason: DisputeReason;
      description: string;
    }) => {
      const { data, error } = await supabase
        .from('disputes')
        .insert({
          job_id: input.jobId,
          customer_id: input.customerId,
          provider_id: input.providerId,
          reason: input.reason,
          description: input.description.trim(),
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as Dispute;
    },
    onSuccess: (dispute) => {
      queryClient.invalidateQueries({ queryKey: ['dispute', 'job', dispute.job_id] });
    },
  });
}
