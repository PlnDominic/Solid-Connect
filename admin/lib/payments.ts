import type { createAdminClient } from './admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Turns a failed Supabase write into a thrown error so a server action
 * fails loudly instead of the UI reporting success after a dropped write. */
export function assertOk(error: { message: string } | null | undefined, what: string): void {
  if (error) throw new Error(`${what} failed: ${error.message}`);
}

// Statuses an admin can set by hand. deposit_held / held / forfeited (0065)
// only ever come from Hubtel or cancel_job.
export type PaymentStatus = 'pending' | 'released' | 'refunded' | 'partially_refunded';

type ApplyArgs = {
  paymentId: string;
  status: PaymentStatus;
  adminId: string;
  reason?: string;
  refundAmount?: number;
  /** Dispute refunds have always cleared released_at on a full refund. */
  clearReleasedAtOnRefund?: boolean;
};

const RESTORE_FIELDS = 'status, released_at, refund_reason, refund_amount, overridden_by, overridden_at';

/**
 * Moves a payment to a new status and keeps its payout leg
 * (provider_payouts) consistent with it, as one all-or-nothing unit:
 * if the payout sync fails, the payment row is put back exactly as it
 * was and the error is rethrown, so the ledger and payouts can't drift
 * apart. A payout already marked paid is never resized or removed; that
 * is a real clawback conversation, not something to do silently.
 *
 * Returns the payment's pre-change amount for audit notes.
 */
export async function applyPaymentStatus(adminClient: AdminClient, args: ApplyArgs): Promise<{ amount: number }> {
  const { paymentId, status, adminId, reason = '', refundAmount = 0 } = args;

  const { data: payment, error: readError } = await adminClient
    .from('payments')
    .select(`job_id, amount, ${RESTORE_FIELDS}`)
    .eq('id', paymentId)
    .maybeSingle();
  assertOk(readError, 'Reading the payment');
  if (!payment) throw new Error('Payment not found.');

  if (status === 'partially_refunded' && (!(refundAmount > 0) || refundAmount >= payment.amount)) {
    throw new Error('A partial refund must be more than 0 and less than the full amount.');
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, overridden_by: adminId, overridden_at: now };
  if (status === 'released') {
    patch.released_at = now;
    patch.refund_amount = null;
  }
  if (status === 'refunded') {
    patch.refund_reason = reason || 'Manual admin override';
    patch.refund_amount = null;
    if (args.clearReleasedAtOnRefund) patch.released_at = null;
  }
  if (status === 'partially_refunded') {
    patch.released_at = now;
    patch.refund_reason = reason || 'Manual admin partial refund';
    patch.refund_amount = refundAmount;
  }
  if (status === 'pending') {
    patch.released_at = null;
    patch.refund_reason = null;
    patch.refund_amount = null;
  }

  const { error: updateError } = await adminClient.from('payments').update(patch).eq('id', paymentId);
  assertOk(updateError, 'Updating the payment');

  try {
    await syncPayout(adminClient, paymentId, payment.job_id, payment.amount, status, refundAmount);
  } catch (err) {
    await adminClient
      .from('payments')
      .update({
        status: payment.status,
        released_at: payment.released_at,
        refund_reason: payment.refund_reason,
        refund_amount: payment.refund_amount,
        overridden_by: payment.overridden_by,
        overridden_at: payment.overridden_at,
      })
      .eq('id', paymentId);
    throw err;
  }

  return { amount: payment.amount };
}

async function syncPayout(
  adminClient: AdminClient,
  paymentId: string,
  jobId: string,
  amount: number,
  status: PaymentStatus,
  refundAmount: number,
): Promise<void> {
  if (status === 'released' || status === 'partially_refunded') {
    const { data: existing, error: existingError } = await adminClient
      .from('provider_payouts')
      .select('status')
      .eq('payment_id', paymentId)
      .maybeSingle();
    assertOk(existingError, 'Reading the payout');
    if (existing?.status === 'paid') return;

    const { data: job, error: jobError } = await adminClient.from('jobs').select('provider_id').eq('id', jobId).maybeSingle();
    assertOk(jobError, 'Reading the job');
    if (!job) throw new Error('Job not found for this payment.');

    const { data: config, error: configError } = await adminClient
      .from('platform_config')
      .select('commission_percent')
      .eq('id', true)
      .maybeSingle();
    assertOk(configError, 'Reading the commission rate');
    const commission = config?.commission_percent ?? 15;
    const gross = status === 'partially_refunded' ? amount - refundAmount : amount;

    const { error: upsertError } = await adminClient.from('provider_payouts').upsert(
      {
        payment_id: paymentId,
        provider_id: job.provider_id,
        gross_amount: gross,
        commission_amount: Math.round(gross * commission) / 100,
        net_amount: Math.round(gross * (100 - commission)) / 100,
      },
      { onConflict: 'payment_id' },
    );
    assertOk(upsertError, 'Saving the payout');
    return;
  }

  const { error: deleteError } = await adminClient.from('provider_payouts').delete().eq('payment_id', paymentId).eq('status', 'pending');
  assertOk(deleteError, 'Cancelling the pending payout');
}
