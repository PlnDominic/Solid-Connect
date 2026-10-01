import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Dispute, DisputeReason } from '../types/database';

async function uploadDisputePhoto(userId: string, imageUri: string): Promise<string> {
  const response = await fetch(imageUri);
  const arrayBuffer = await response.arrayBuffer();
  const path = `${userId}/dispute-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('request-photos').upload(path, arrayBuffer, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('request-photos').getPublicUrl(path);
  return data.publicUrl;
}

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
      photoUris?: string[];
    }) => {
      const evidenceUrls: string[] = [];
      for (const uri of input.photoUris ?? []) {
        evidenceUrls.push(await uploadDisputePhoto(input.customerId, uri));
      }
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: Dispute }>(`/api/v1/disputes`, {
          method: 'POST',
          body: JSON.stringify({
            jobId: input.jobId,
            reason: input.reason,
            description: input.description.trim(),
            evidenceUrls,
          }),
        });
        return res.data;
      }
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
      if (evidenceUrls.length && data?.id) {
        await supabase.from('dispute_evidence').insert(
          evidenceUrls.map((photo_url) => ({ dispute_id: data.id, uploaded_by: input.customerId, photo_url })),
        );
      }
      return data as Dispute;
    },
    onSuccess: (dispute) => {
      queryClient.invalidateQueries({ queryKey: ['dispute', 'job', dispute.job_id] });
    },
  });
}
