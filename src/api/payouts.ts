import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../store/useSessionStore';
import type { ProviderPayoutAccount } from '../types/database';

export const PAYOUT_STORAGE_KEY_PREFIX = 'solid-connect:payout-account:';

export async function getCachedPayoutAccount(userId: string): Promise<ProviderPayoutAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PAYOUT_STORAGE_KEY_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw) as ProviderPayoutAccount;
  } catch {
    // Ignore cache read failures.
  }
  return null;
}

export async function setCachedPayoutAccount(userId: string, account: ProviderPayoutAccount | null): Promise<void> {
  try {
    const key = `${PAYOUT_STORAGE_KEY_PREFIX}${userId}`;
    if (account) {
      await AsyncStorage.setItem(key, JSON.stringify(account));
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // Ignore cache write failures.
  }
}

/** Fetches the provider's configured payout destination account. */
export function usePayoutAccount(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['payoutAccount', userId],
    queryFn: async (): Promise<ProviderPayoutAccount | null> => {
      if (!userId) return null;
      // The column isn't selectable since 0075; my_payout_account() returns
      // the signed-in provider's own (nobody else's).
      let { data, error } = await supabase.rpc('my_payout_account');
      if (error?.code === 'PGRST202') {
        // Database not migrated to 0075 yet: read the column the old way.
        const res = await supabase.from('profiles').select('payout_account').eq('id', userId).maybeSingle();
        data = (res.data as { payout_account?: unknown } | null)?.payout_account ?? null;
        error = res.error;
      }

      if (error) {
        // Fallback to locally cached account if offline or network error.
        const cached = await getCachedPayoutAccount(userId);
        if (cached) return cached;
        throw error;
      }

      const account = (data as ProviderPayoutAccount | null) ?? null;
      if (account) {
        await setCachedPayoutAccount(userId, account);
      }
      return account;
    },
    enabled: !!userId,
  });
}

/** Updates the provider's payout account in profiles and local cache. */
export function useUpdatePayoutAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      account,
    }: {
      userId: string;
      account: ProviderPayoutAccount;
    }): Promise<ProviderPayoutAccount> => {
      // No `.select()` back: the column isn't readable since 0075.
      const { error } = await supabase.from('profiles').update({ payout_account: account }).eq('id', userId);

      if (error) throw error;

      await setCachedPayoutAccount(userId, account);

      // Keep in-memory session store profile in sync immediately.
      const currentProfile = useSessionStore.getState().profile;
      if (currentProfile && currentProfile.id === userId) {
        useSessionStore.getState().setProfile({
          ...currentProfile,
          payout_account: account,
        });
      }

      return account;
    },
    onSuccess: (account, { userId }) => {
      queryClient.setQueryData(['payoutAccount', userId], account);
      queryClient.invalidateQueries({ queryKey: ['payoutAccount', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
