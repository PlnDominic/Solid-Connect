import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type ReportReason = 'harassment' | 'scam_or_fraud' | 'inappropriate_content' | 'unsafe_behavior' | 'fake_profile' | 'other';
export type ReportContext = 'profile' | 'chat' | 'job';

export const REPORT_REASONS: { key: ReportReason; label: string; hint: string }[] = [
  { key: 'harassment', label: 'Harassment or abuse', hint: 'Insults, threats or unwanted contact' },
  { key: 'scam_or_fraud', label: 'Scam or fraud', hint: 'Asking to pay outside the app, fake offers' },
  { key: 'inappropriate_content', label: 'Inappropriate content', hint: 'Offensive photos or messages' },
  { key: 'unsafe_behavior', label: 'Unsafe behaviour', hint: 'Made you feel unsafe' },
  { key: 'fake_profile', label: 'Fake profile', hint: 'Pretending to be someone else' },
  { key: 'other', label: 'Something else', hint: '' },
];

export interface BlockedUser {
  blocked_id: string;
  created_at: string;
}

export function useMyBlocks(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['blocks', userId],
    queryFn: async (): Promise<BlockedUser[]> => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id, created_at')
        .eq('blocker_id', userId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlockedUser[];
    },
    enabled: !!userId,
  });
}

/** Everyone the signed-in person has blocked or been blocked by, so
 * provider lists and search can leave them out. */
export function useBlockPartners(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['blockPartners', userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.rpc('my_block_partners');
      if (error) return new Set();
      return new Set(((data ?? []) as (string | { my_block_partners: string })[]).map((r) => (typeof r === 'string' ? r : r.my_block_partners)));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useBlockUser(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase.from('user_blocks').insert({ blocker_id: userId as string, blocked_id: blockedId });
      // Already blocked is fine: the goal state is reached.
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', userId] });
      queryClient.invalidateQueries({ queryKey: ['blockPartners', userId] });
    },
  });
}

export function useUnblockUser(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', userId as string)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', userId] });
      queryClient.invalidateQueries({ queryKey: ['blockPartners', userId] });
    },
  });
}

export function useReportUser(reporterId: string | null | undefined) {
  return useMutation({
    mutationFn: async (input: {
      reportedId: string;
      reason: ReportReason;
      context: ReportContext;
      details?: string;
      jobId?: string | null;
      threadId?: string | null;
    }) => {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: reporterId as string,
        reported_id: input.reportedId,
        reason: input.reason,
        context: input.context,
        details: (input.details ?? '').trim(),
        job_id: input.jobId ?? null,
        thread_id: input.threadId ?? null,
      });
      if (error) throw error;
    },
  });
}

export function useCreateSafetyAlert(userId: string | null | undefined) {
  return useMutation({
    mutationFn: async (input: { jobId: string | null; lat: number | null; lng: number | null; note?: string }) => {
      const { error } = await supabase.from('safety_alerts').insert({
        user_id: userId as string,
        job_id: input.jobId,
        lat: input.lat,
        lng: input.lng,
        note: (input.note ?? '').trim(),
      });
      if (error) throw error;
    },
  });
}

export function friendlySafetyError(err: unknown): string {
  const message =
    err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  if (message.includes('REPORT_RATE_LIMIT')) return 'You have sent a lot of reports today. Please try again tomorrow.';
  if (message.includes('ALERT_RATE_LIMIT')) return 'You already sent several alerts. Our team has them. Call 112 if you are in danger.';
  if (message.includes('BLOCKED')) return 'You cannot message this person.';
  return 'Something went wrong. Please try again.';
}
