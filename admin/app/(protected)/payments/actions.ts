'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

const VALID_STATUSES = ['pending', 'released', 'refunded', 'partially_refunded'];

/** Manually overrides a payment's status - stands in for what a real
 * payment gateway's webhook/dashboard would do once one is connected.
 * Every override is attributed and audit-logged; refunds also record a
 * reason directly on the row (shown in the ledger) since that's the one
 * override an account holder or a future support agent most needs to see
 * without digging into the audit log.
 *
 * Also keeps the payout leg (provider_payouts) honest: releasing a
 * payment this way owes the provider a payout exactly like
 * confirm_job_completion creating one automatically does; reversing a
 * payment that hasn't actually been paid out yet cancels that pending
 * payout, since nothing is owed anymore. A payout already marked *paid*
 * is left alone either way - that's a real clawback conversation with
 * the provider, not something this action should silently undo.
 *
 * `partially_refunded` is its own terminal state, not a variant of
 * `refunded`: money moves both ways at once - refund_amount back to the
 * customer, and a payout for the remainder (amount - refund_amount) still
 * owed to the provider - closing the gap docs/legal/refund-dispute-policy.md
 * §4 used to flag explicitly ("a payment is refunded or released, not
 * split"). Reads reason/refundAmount from FormData rather than plain
 * args so the one button that needs a number (Partial refund) can supply
 * it - the Release/Refund/Reset buttons just submit an empty form. */
export async function setPaymentStatus(id: string, status: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  if (!VALID_STATUSES.includes(status)) return;

  const reason = String(formData.get('reason') ?? '').trim();
  const refundAmount = Math.round(Number(formData.get('refundAmount') ?? 0));

  const adminClient = createAdminClient();
  const { data: payment } = await adminClient.from('payments').select('job_id, amount').eq('id', id).maybeSingle();
  if (!payment) return;

  if (status === 'partially_refunded' && (!refundAmount || refundAmount <= 0 || refundAmount >= payment.amount)) {
    // Not a valid split - 0 is nothing to refund, and >= the full amount
    // is just a full refund (use that button instead).
    return;
  }

  const patch: Record<string, unknown> = {
    status,
    overridden_by: admin.id,
    overridden_at: new Date().toISOString(),
  };
  if (status === 'released') {
    patch.released_at = new Date().toISOString();
    patch.refund_amount = null;
  }
  if (status === 'refunded') {
    patch.refund_reason = reason || 'Manual admin override';
    patch.refund_amount = null;
  }
  if (status === 'partially_refunded') {
    patch.released_at = new Date().toISOString();
    patch.refund_reason = reason || 'Manual admin partial refund';
    patch.refund_amount = refundAmount;
  }
  if (status === 'pending') {
    patch.released_at = null;
    patch.refund_reason = null;
    patch.refund_amount = null;
  }

  await adminClient.from('payments').update(patch).eq('id', id);

  const grossForPayout = status === 'partially_refunded' ? payment.amount - refundAmount : payment.amount;
  if ((status === 'released' || status === 'partially_refunded') && payment) {
    const { data: existingPayout } = await adminClient
      .from('provider_payouts')
      .select('status')
      .eq('payment_id', id)
      .maybeSingle();
    // A payout already marked paid is a real clawback conversation, not
    // something this override should silently resize.
    if (existingPayout?.status !== 'paid') {
      const { data: job } = await adminClient.from('jobs').select('provider_id').eq('id', payment.job_id).maybeSingle();
      const { data: config } = await adminClient.from('platform_config').select('commission_percent').eq('id', true).maybeSingle();
      const commission = config?.commission_percent ?? 15;
      if (job) {
        await adminClient.from('provider_payouts').upsert(
          {
            payment_id: id,
            provider_id: job.provider_id,
            gross_amount: grossForPayout,
            commission_amount: Math.round(grossForPayout * commission) / 100,
            net_amount: Math.round(grossForPayout * (100 - commission)) / 100,
          },
          { onConflict: 'payment_id' },
        );
      }
    }
  } else {
    // Cancel a not-yet-paid payout when the payment is reversed away from
    // released/partially-refunded; a payout already marked paid is left
    // untouched - that's the clawback conversation noted above.
    await adminClient.from('provider_payouts').delete().eq('payment_id', id).eq('status', 'pending');
  }

  await logAdminAction(admin, 'OVERRODE_PAYMENT', {
    targetType: 'payment',
    targetId: id,
    note:
      status === 'partially_refunded'
        ? `Partially refunded GH₵${refundAmount} of GH₵${payment.amount}${reason ? `: ${reason}` : ''}`
        : `Set status to ${status}${status === 'refunded' && reason ? `: ${reason}` : ''}`,
  });

  revalidatePath('/payments');
  revalidatePath('/payouts');
}
