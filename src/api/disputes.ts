import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import { useRealtimeInvalidate } from '../hooks/useRealtimeInvalidate';
import { compressImage } from '../lib/imageCompression';
import { evidencePath } from '../lib/disputeCase';
import { supabase } from '../lib/supabase';
import type { Dispute, DisputeEvidence, DisputeReason } from '../types/database';

const ERROR_COPY: Record<string, string> = {
  DISPUTE_CLOSED: 'This dispute has already been resolved.',
  ALREADY_RESPONDED: 'You have already responded to this dispute.',
  RESPONSE_REQUIRED: 'Write your response first.',
  RESPONSE_TOO_LONG: 'Keep your response under 2,000 characters.',
  EVIDENCE_LIMIT: 'You can attach up to 5 photos.',
  FORBIDDEN: 'You are not part of this dispute.',
  TOO_EARLY_TO_REPORT: 'You can report an unpaid balance 72 hours after finishing the job.',
  DISPUTE_EXISTS: 'This job already has a dispute open with Solid Connect.',
  JOB_NOT_AWAITING_PAYMENT: 'This job is not waiting on the customer.',
};

export function friendlyDisputeError(err: unknown): string {
  const message =
    err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  const code = Object.keys(ERROR_COPY).find((c) => message.includes(c));
  return code ? ERROR_COPY[code] : 'Something went wrong. Please try again.';
}

export function useJobDispute(jobId: string | null | undefined) {
  const query = useQuery({
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

  // The other side's response and the admin's resolution should appear
  // without leaving and re-entering the screen.
  useRealtimeInvalidate({
    channel: `dispute:${jobId}`,
    table: 'disputes',
    filter: jobId ? `job_id=eq.${jobId}` : undefined,
    queryKeys: [['dispute', 'job', jobId]],
    enabled: !!jobId,
  });

  return query;
}

export type EvidenceItem = DisputeEvidence & { url: string | null };

/** A dispute's evidence with short-lived signed URLs (the bucket is private). */
export function useDisputeEvidence(disputeId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['dispute', 'evidence', disputeId],
    queryFn: async (): Promise<EvidenceItem[]> => {
      const { data, error } = await supabase
        .from('dispute_evidence')
        .select('*')
        .eq('dispute_id', disputeId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as DisputeEvidence[];
      if (!rows.length) return [];
      const { data: signed } = await supabase.storage
        .from('dispute-evidence')
        .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return rows.map((r) => ({ ...r, url: byPath.get(r.storage_path) ?? null }));
    },
    enabled: !!disputeId,
    // Signed URLs expire after an hour; don't keep serving dead ones.
    staleTime: 30 * 60_000,
  });

  useRealtimeInvalidate({
    channel: `dispute-evidence:${disputeId}`,
    table: 'dispute_evidence',
    filter: disputeId ? `dispute_id=eq.${disputeId}` : undefined,
    queryKeys: [['dispute', 'evidence', disputeId]],
    enabled: !!disputeId,
  });

  return query;
}

/** Uploads picked photos (compressed) to the private bucket and records
 * them. Photos that fail are skipped, not fatal - `failed` says how many. */
export function useAddDisputeEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { disputeId: string; authorId: string; imageUris: string[] }) => {
      let failed = 0;
      const now = Date.now();
      for (const [i, uri] of input.imageUris.entries()) {
        try {
          const compressed = await compressImage(uri);
          const buffer = await (await fetch(compressed)).arrayBuffer();
          const path = evidencePath(input.disputeId, input.authorId, now, i);
          const { error: upErr } = await supabase.storage
            .from('dispute-evidence')
            .upload(path, buffer, { contentType: 'image/jpeg' });
          if (upErr) throw upErr;
          const { error } = await supabase
            .from('dispute_evidence')
            .insert({ dispute_id: input.disputeId, author_id: input.authorId, storage_path: path });
          if (error) throw error;
        } catch {
          failed += 1;
        }
      }
      return { failed };
    },
    onSuccess: (_r, input) => {
      queryClient.invalidateQueries({ queryKey: ['dispute', 'evidence', input.disputeId] });
    },
  });
}

/** Provider escalation (0065): 72h after finishing, if the balance still
 * isn't paid and the job confirmed, hand it to Solid Connect. Opens the
 * job's dispute with reason unpaid_balance. */
export function useReportUnpaidBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; note?: string }) => {
      const { data, error } = await supabase.rpc('report_unpaid_balance', {
        p_job_id: input.jobId,
        p_note: input.note ?? '',
      });
      if (error) throw error;
      return data as Dispute;
    },
    onSuccess: (dispute) => {
      queryClient.invalidateQueries({ queryKey: ['dispute', 'job', dispute.job_id] });
    },
  });
}

/** The provider's one written response to a dispute. */
export function useRespondToDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { disputeId: string; response: string }) => {
      const { data, error } = await supabase.rpc('respond_to_dispute', {
        p_dispute_id: input.disputeId,
        p_response: input.response,
      });
      if (error) throw error;
      return data as Dispute;
    },
    onSuccess: (dispute) => {
      queryClient.invalidateQueries({ queryKey: ['dispute', 'job', dispute.job_id] });
    },
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
      // Evidence photos are attached afterwards with useAddDisputeEvidence.
      if (isApiConfigured()) {
        const res = await apiFetch<{ data: Dispute }>(`/api/v1/disputes`, {
          method: 'POST',
          body: JSON.stringify({
            jobId: input.jobId,
            reason: input.reason,
            description: input.description.trim(),
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
      return data as Dispute;
    },
    onSuccess: (dispute) => {
      queryClient.invalidateQueries({ queryKey: ['dispute', 'job', dispute.job_id] });
    },
  });
}
