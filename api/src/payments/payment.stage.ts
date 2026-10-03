/**
 * What the customer owes Solid Connect next on a job (see migration 0065).
 * Customers never pay providers directly: a deposit secures the booking,
 * the balance is due once the provider has finished.
 */
export type PaymentState = { amount: number; deposit_amount: number | null; status: string };

export type NextCharge =
  | { kind: 'deposit' | 'balance' | 'full'; amount: number }
  | { kind: 'none'; reason: 'PAID' | 'BALANCE_NOT_DUE' | 'NOT_PAYABLE' };

export function nextCharge(payment: PaymentState, jobStatus: string): NextCharge {
  const deposit = Number(payment.deposit_amount ?? 0);
  const total = Number(payment.amount);
  switch (payment.status) {
    case 'pending':
      // Deposits off (or a booking from before them): one payment, any time.
      if (deposit <= 0) return { kind: 'full', amount: total };
      return { kind: 'deposit', amount: deposit };
    case 'deposit_held':
      if (jobStatus !== 'awaiting_completion_confirmation') return { kind: 'none', reason: 'BALANCE_NOT_DUE' };
      return { kind: 'balance', amount: Math.max(total - deposit, 0) };
    case 'held':
    case 'released':
      return { kind: 'none', reason: 'PAID' };
    default:
      return { kind: 'none', reason: 'NOT_PAYABLE' };
  }
}

/** Hubtel client references: one per stage, so each checkout is captured on its own. */
export function stageReference(paymentId: string, kind: 'deposit' | 'balance' | 'full'): string {
  const id = paymentId.replace(/-/g, '');
  return kind === 'deposit' ? `sd_${id}` : `sc_${id}`;
}
