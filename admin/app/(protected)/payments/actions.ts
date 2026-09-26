'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { applyPaymentStatus, type PaymentStatus } from '../../../lib/payments';

const VALID_STATUSES: PaymentStatus[] = ['pending', 'released', 'refunded', 'partially_refunded'];

/** Manually overrides a payment's status - stands in for what a real
 * payment gateway's webhook/dashboard would do once one is connected.
 * Every override is attributed and audit-logged; refunds also record a
 * reason directly on the row (shown in the ledger).
 *
 * The payment and its payout leg change together or not at all (see
 * applyPaymentStatus): releasing owes the provider a payout, reversing a
 * not-yet-paid payment cancels it, and a payout already marked paid is
 * left alone. `partially_refunded` sends refund_amount back to the
 * customer and pays the provider the remainder. Reads reason/refundAmount
 * from FormData so the one button that needs a number (Partial refund)
 * can supply it. */
export async function setPaymentStatus(id: string, status: string, formData: FormData): Promise<void> {
  const admin = await requirePermission('payments');
  if (!admin) return;
  if (!VALID_STATUSES.includes(status as PaymentStatus)) return;

  const reason = String(formData.get('reason') ?? '').trim();
  const refundAmount = Math.round(Number(formData.get('refundAmount') ?? 0));
  if (status === 'partially_refunded' && !Number.isFinite(refundAmount)) return;

  const { amount } = await applyPaymentStatus(createAdminClient(), {
    paymentId: id,
    status: status as PaymentStatus,
    adminId: admin.id,
    reason,
    refundAmount,
  });

  await logAdminAction(admin, 'OVERRODE_PAYMENT', {
    targetType: 'payment',
    targetId: id,
    note:
      status === 'partially_refunded'
        ? `Partially refunded GH₵${refundAmount} of GH₵${amount}${reason ? `: ${reason}` : ''}`
        : `Set status to ${status}${status === 'refunded' && reason ? `: ${reason}` : ''}`,
  });

  revalidatePath('/payments');
  revalidatePath('/payouts');
}
