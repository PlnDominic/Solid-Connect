import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, isApiConfigured } from '../lib/api';
import type { Payment } from '../types/database';

export async function startHubtelCheckout(jobId: string) {
  if (!isApiConfigured()) throw new Error('API is not configured.');
  return apiFetch<{ data: { checkoutUrl: string | null; alreadyPaid: boolean; payment: Payment } }>(
    `/api/v1/payments/jobs/${jobId}/checkout`,
    { method: 'POST' },
  );
}

export function useHubtelCheckout(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startHubtelCheckout(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', jobId] });
    },
  });
}

export function useRefreshHubtelPayment(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isApiConfigured()) return null;
      return apiFetch<{ data: Payment }>(`/api/v1/payments/jobs/${jobId}/refresh`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', jobId] });
    },
  });
}
