import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

export function useSavedProviders(customerId: string | null) {
  return useQuery({
    queryKey: ['savedProviders', customerId],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('saved_providers')
        .select('provider:profiles!saved_providers_provider_id_fkey(*)')
        .eq('customer_id', customerId as string);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.provider as Profile);
    },
    enabled: !!customerId,
  });
}

export function useIsProviderSaved(customerId: string | null, providerId: string | null) {
  return useQuery({
    queryKey: ['savedProvider', customerId, providerId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('saved_providers')
        .select('provider_id')
        .eq('customer_id', customerId as string)
        .eq('provider_id', providerId as string)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!customerId && !!providerId,
  });
}

export function useToggleSavedProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { customerId: string; providerId: string; saved: boolean }) => {
      if (input.saved) {
        const { error } = await supabase
          .from('saved_providers')
          .delete()
          .eq('customer_id', input.customerId)
          .eq('provider_id', input.providerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_providers')
          .insert({ customer_id: input.customerId, provider_id: input.providerId });
        if (error) throw error;
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['savedProviders', vars.customerId] });
      queryClient.invalidateQueries({ queryKey: ['savedProvider', vars.customerId, vars.providerId] });
    },
  });
}
