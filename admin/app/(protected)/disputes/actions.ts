'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { applyPaymentStatus, assertOk } from '../../../lib/payments';

export async function resolveDispute(id: string, formData: FormData): Promise<void> {
  const note = String(formData.get('note') ?? '').trim();
  // A number here can mean either a full or a partial refund - resolved
  // against the payment's actual amount once that's loaded below - so one
  // field covers both instead of a separate full-refund checkbox plus a
  // partial-amount field.
  const refundAmountRaw = formData.get('refundAmount');
  const refundAmount = refundAmountRaw ? Math.round(Number(refundAmountRaw)) : 0;
  if (!note || !Number.isFinite(refundAmount)) return;

  const admin = await requirePermission('disputes');
  if (!admin) return;

  const adminClient = createAdminClient();
  const { data: dispute, error: disputeError } = await adminClient.from('disputes').select('job_id, status').eq('id', id).maybeSingle();
  assertOk(disputeError, 'Reading the dispute');
  // Already resolved: don't refund a second time.
  if (!dispute || dispute.status !== 'open') return;

  // Refund first, so a failed refund leaves the dispute open to retry
  // rather than marked resolved with no money moved. Disputes and payments
  // share applyPaymentStatus with the Payments ledger, so the payout leg
  // is recomputed the same way (see lib/payments.ts).
  let refundNote = '';
  if (refundAmount > 0 && dispute.job_id) {
    const { data: payment, error: paymentError } = await adminClient
      .from('payments')
      .select('id, amount, deposit_amount, status')
      .eq('job_id', dispute.job_id)
      .maybeSingle();
    assertOk(paymentError, 'Reading the payment');

    if (payment) {
      // With deposits (0065) Solid Connect may only hold the deposit so far;
      // a "full" refund is everything actually received.
      const depositOnly = payment.status === 'deposit_held' && (payment.deposit_amount ?? 0) > 0;
      const received = depositOnly ? payment.deposit_amount : payment.amount;
      const isFull = refundAmount >= received;
      await applyPaymentStatus(adminClient, {
        paymentId: payment.id,
        status: isFull ? 'refunded' : 'partially_refunded',
        adminId: admin.id,
        reason: `Dispute resolution: ${note}`,
        refundAmount,
        clearReleasedAtOnRefund: true,
      });
      if (isFull && depositOnly) {
        const { error: depositError } = await adminClient
          .from('payments')
          .update({ refund_amount: received })
          .eq('id', payment.id);
        assertOk(depositError, 'Recording the deposit refund');
      }
      refundNote = isFull
        ? depositOnly
          ? ` (deposit of GH₵${received} refunded)`
          : ' (refunded in full)'
        : ` (partially refunded GH₵${refundAmount} of GH₵${payment.amount})`;
    }
  }

  const { error: resolveError } = await adminClient
    .from('disputes')
    .update({ status: 'resolved', resolution_note: note, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open');
  assertOk(resolveError, 'Resolving the dispute');

  await logAdminAction(admin, 'RESOLVED_DISPUTE', { targetType: 'dispute', targetId: id, note: `${note}${refundNote}` });

  revalidatePath('/disputes');
  revalidatePath('/payments');
  revalidatePath('/payouts');
}
