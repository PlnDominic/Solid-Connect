import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';

// Client half of supabase/migrations/0060_referral_rewards.sql. The code,
// ledger and guards all live server-side; this module is just typed RPC
// wrappers plus the invite deep link the ReferralScreen shares.

export interface ReferralSummary {
  code: string | null;
  invitedCount: number;
  joinedCount: number;
  earnedCount: number;
  /** GHS credit earned (paid out with real payouts - Phase G). */
  earnedAmount: number;
  /** Referrals tracked with a status but not yet earned (invitee's first job still pending). */
  pendingCount: number;
  invited: { name: string; status: 'pending' | 'earned' | 'paid'; createdAt: string }[];
}

export interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_id: string;
  code_used: string;
  status: 'pending' | 'earned' | 'paid';
  reward_amount: number | null;
  job_id: string | null;
  earned_at: string | null;
  paid_at: string | null;
  created_at: string;
}

/** Solidconnect:// deep link into the Referral screen (see linking.ts). */
export function referralDeepLink(code: string): string {
  return `solidconnect://referral?code=${encodeURIComponent(code)}`;
}

export async function fetchMyReferralCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_referral_code');
  if (error) throw error;
  return (data as string | null) ?? null;
}

async function fetchReferralSummary(): Promise<ReferralSummary> {
  const [code, { data: rows, error }] = await Promise.all([
    fetchMyReferralCode().catch(() => null),
    supabase
      .from('referrals')
      .select('id, referrer_id, referred_id, code_used, status, reward_amount, job_id, earned_at, paid_at, created_at')
      .order('created_at', { ascending: false }),
  ]);
  if (error) throw error;
  const referralRows = (rows ?? []) as ReferralRow[];

  // Referrals RLS only ever returns rows where I'm the referrer or the
  // referred party, so every row here with me as referrer is an invite.
  const invited = referralRows.filter((r) => r.referrer_id != null);
  // Names come from profiles (publicly readable); batch-fetch the referred
  // users so the list can show who joined.
  const nameById = new Map<string, string>();
  const referredIds = [...new Set(invited.map((r) => r.referred_id))];
  if (referredIds.length) {
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', referredIds);
    for (const p of people ?? []) nameById.set(p.id, p.full_name);
  }

  const earned = invited.filter((r) => r.status === 'earned' || r.status === 'paid');
  return {
    code: code ?? null,
    invitedCount: invited.length,
    joinedCount: invited.length,
    earnedCount: earned.length,
    earnedAmount: earned.reduce((sum, r) => sum + (r.reward_amount ?? 0), 0),
    pendingCount: invited.length - earned.length,
    invited: invited.map((r) => ({
      name: nameById.get(r.referred_id) ?? 'A new neighbor',
      status: r.status,
      createdAt: r.created_at,
    })),
  };
}

export function useReferralSummary(enabled: boolean) {
  return useQuery({
    queryKey: ['referral-summary'],
    queryFn: fetchReferralSummary,
    enabled,
  });
}

/** Validates a code and returns the referrer's first name, or null. */
export async function lookupReferral(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('lookup_referral', { p_code: code });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/**
 * Claims an invite code as the current user. Only valid within 30 days of
 * account creation and once per account - the RPC enforces that and this
 * surfaces its error codes to the caller's UI.
 */
export async function claimReferral(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
  if (error) throw error;
  return Boolean(data);
}

export function useClaimReferral() {
  return useMutation({
    mutationFn: claimReferral,
  });
}

// ── pending-code handoff (sign-in → claim) ─────────────────────────────
// The invite link is opened before an account exists, so the code is held
// in AsyncStorage until AuthFlowScreen finishes signup and can claim it.
// Same local-only cache pattern as NotificationsScreen's prefs cache.

const PENDING_CODE_KEY = 'solid-connect:pending-referral-code';

export async function stashPendingReferralCode(code: string): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(PENDING_CODE_KEY, code.trim().toUpperCase());
}

export async function popPendingReferralCode(): Promise<string | null> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const raw = await AsyncStorage.getItem(PENDING_CODE_KEY);
  if (raw) await AsyncStorage.removeItem(PENDING_CODE_KEY);
  return raw;
}
