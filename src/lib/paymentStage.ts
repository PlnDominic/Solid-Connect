import type { Payment } from '../types/database';

/**
 * What the customer owes Solid Connect next on a job - mirrors the API's
 * nextCharge (api/src/payments/payment.stage.ts) so the buttons say the
 * right thing. Customers never pay providers directly: a deposit secures
 * the booking, the balance is due once the provider has finished.
 */
export type PaymentStep =
  | { kind: 'deposit' | 'balance' | 'full'; amount: number }
  | { kind: 'balance_not_due' | 'paid' | 'closed' };

export function paymentStep(payment: Pick<Payment, 'amount' | 'deposit_amount' | 'status'>, jobStatus: string): PaymentStep {
  const deposit = Number(payment.deposit_amount ?? 0);
  const total = Number(payment.amount);
  switch (payment.status) {
    case 'pending':
      return deposit > 0 ? { kind: 'deposit', amount: deposit } : { kind: 'full', amount: total };
    case 'deposit_held':
      return jobStatus === 'awaiting_completion_confirmation'
        ? { kind: 'balance', amount: Math.max(total - deposit, 0) }
        : { kind: 'balance_not_due' };
    case 'held':
    case 'released':
      return { kind: 'paid' };
    default:
      return { kind: 'closed' };
  }
}

/** True once the booking is secured (deposit in, or no deposit required). */
export function bookingSecured(payment: Pick<Payment, 'deposit_amount' | 'status'> | null | undefined): boolean {
  if (!payment) return true;
  if (payment.status !== 'pending') return true;
  return Number(payment.deposit_amount ?? 0) <= 0;
}
