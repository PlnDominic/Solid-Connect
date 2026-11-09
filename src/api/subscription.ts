import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';

export type SubscriptionStatus = {
  active: boolean;
  expiresAt: string | null;
  trialUsed: boolean;
  canTakeWork: boolean;
  price: number;
  periodDays: number;
  currency: string;
};

const KEY = ['provider-subscription'];

export function useSubscription() {
  return useQuery({
    queryKey: KEY,
    enabled: isApiConfigured(),
    queryFn: async () => (await apiFetch<{ data: SubscriptionStatus }>('/api/v1/subscriptions/me')).data,
  });
}

export function useSubscriptionCheckout() {
  return useMutation({
    mutationFn: async () =>
      (await apiFetch<{ data: { checkoutUrl: string } }>('/api/v1/subscriptions/checkout', { method: 'POST' })).data,
  });
}

export function useRefreshSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await apiFetch<{ data: SubscriptionStatus }>('/api/v1/subscriptions/refresh', { method: 'POST' })).data,
    onSuccess: (data) => queryClient.setQueryData(KEY, data),
  });
}
