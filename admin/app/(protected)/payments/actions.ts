'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

const VALID_STATUSES = ['pending', 'released', 'refunded'];

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
 * the provider, not something this action should silently undo. */
export async function setPaymentStatus(id: string, status: string, reason: string): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  if (!VALID_STATUSES.includes(status)) return;

  const adminClient = createAdminClient();
  const { data: payment } = await adminClient.from('payments').select('job_id, amount').eq('id', id).maybeSingle();

  const patch: Record<string, unknown> = {
    status,
    overridden_by: admin.id,
    overridden_at: new Date().toISOString(),
  };
  if (status === 'released') patch.released_at = new Date().toISOString();
  if (status === 'refunded') patch.refund_reason = reason || 'Manual admin override';
  if (status === 'pending') {
    patch.released_at = null;
    patch.refund_reason = null;
  }

  await adminClient.from('payments').update(patch).eq('id', id);

  if (status === 'released' && payment) {
    const { data: job } = await adminClient.from('jobs').select('provider_id').eq('id', payment.job_id).maybeSingle();
    const { data: config } = await adminClient.from('platform_config').select('commission_percent').eq('id', true).maybeSingle();
    const commission = config?.commission_percent ?? 15;
    if (job) {
      await adminClient.from('provider_payouts').upsert(
        {
          payment_id: id,
          provider_id: job.provider_id,
          gross_amount: payment.amount,
          commission_amount: Math.round(payment.amount * commission) / 100,
          net_amount: Math.round(payment.amount * (100 - commission)) / 100,
        },
        { onConflict: 'payment_id', ignoreDuplicates: true },
      );
    }
  } else if (status !== 'released') {
    // Cancel a not-yet-paid payout when the payment is reversed away from
    // released; a payout already marked paid is left untouched.
    await adminClient.from('provider_payouts').delete().eq('payment_id', id).eq('status', 'pending');
  }

  await logAdminAction(admin, 'OVERRODE_PAYMENT', {
    targetType: 'payment',
    targetId: id,
    note: `Set status to ${status}${status === 'refunded' && reason ? `: ${reason}` : ''}`,
  });

  revalidatePath('/payments');
  revalidatePath('/payouts');
}
