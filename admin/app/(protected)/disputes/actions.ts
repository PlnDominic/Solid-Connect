'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

export async function resolveDispute(id: string, formData: FormData): Promise<void> {
  const note = String(formData.get('note') ?? '').trim();
  // A number here can mean either a full or a partial refund - resolved
  // against the payment's actual amount once that's loaded below - so one
  // field covers both instead of a separate full-refund checkbox plus a
  // partial-amount field.
  const refundAmountRaw = formData.get('refundAmount');
  const refundAmount = refundAmountRaw ? Math.round(Number(refundAmountRaw)) : 0;
  if (!note) return;

  const admin = await requirePermission('disputes');
  if (!admin) return;

  const adminClient = createAdminClient();
  const { data: dispute } = await adminClient.from('disputes').select('job_id').eq('id', id).maybeSingle();

  await adminClient
    .from('disputes')
    .update({
      status: 'resolved',
      resolution_note: note,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'open');

  // Disputes and payments were previously unconnected - resolving a
  // dispute never touched a payment record. When the outcome includes a
  // refund, do it as part of the same action instead of requiring a
  // second trip to the Payments ledger. refundAmount >= the payment's own
  // amount (or left at the full amount) is a full refund; anything less
  // is a partial one - see payments/actions.ts's setPaymentStatus for the
  // same distinction and the payout-recomputation it requires.
  let refundNote = '';
  if (refundAmount > 0 && dispute?.job_id) {
    const { data: payment } = await adminClient
      .from('payments')
      .select('id, amount')
      .eq('job_id', dispute.job_id)
      .maybeSingle();

    if (payment) {
      const isFull = refundAmount >= payment.amount;
      await adminClient
        .from('payments')
        .update({
          status: isFull ? 'refunded' : 'partially_refunded',
          refund_reason: `Dispute resolution: ${note}`,
          refund_amount: isFull ? null : refundAmount,
          released_at: isFull ? null : new Date().toISOString(),
          overridden_by: admin.id,
          overridden_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (isFull) {
        await adminClient.from('provider_payouts').delete().eq('payment_id', payment.id).eq('status', 'pending');
        refundNote = ' (refunded in full)';
      } else {
        const { data: existingPayout } = await adminClient
          .from('provider_payouts')
          .select('status')
          .eq('payment_id', payment.id)
          .maybeSingle();
        if (existingPayout?.status !== 'paid') {
          const { data: job } = await adminClient.from('jobs').select('provider_id').eq('id', dispute.job_id).maybeSingle();
          const { data: config } = await adminClient.from('platform_config').select('commission_percent').eq('id', true).maybeSingle();
          const commission = config?.commission_percent ?? 15;
          const grossForPayout = payment.amount - refundAmount;
          if (job) {
            await adminClient.from('provider_payouts').upsert(
              {
                payment_id: payment.id,
                provider_id: job.provider_id,
                gross_amount: grossForPayout,
                commission_amount: Math.round(grossForPayout * commission) / 100,
                net_amount: Math.round(grossForPayout * (100 - commission)) / 100,
              },
              { onConflict: 'payment_id' },
            );
          }
        }
        refundNote = ` (partially refunded GH₵${refundAmount} of GH₵${payment.amount})`;
      }
    }
  }

  await logAdminAction(
    admin,
    'RESOLVED_DISPUTE',
    { targetType: 'dispute', targetId: id, note: `${note}${refundNote}` },
  );

  revalidatePath('/disputes');
  revalidatePath('/payments');
  revalidatePath('/payouts');
}
