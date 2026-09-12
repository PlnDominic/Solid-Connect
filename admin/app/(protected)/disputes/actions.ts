'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '../../../lib/admin';
import { createServerSupabase } from '../../../lib/supabase';
import { logAdminAction } from '../../../lib/audit';

export async function resolveDispute(id: string, formData: FormData): Promise<void> {
  const note = String(formData.get('note') ?? '').trim();
  const alsoRefund = formData.get('refund') === 'on';
  if (!note) return;

  const sessionClient = await createServerSupabase();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return;

  const adminClient = createAdminClient();
  const { data: admin } = await adminClient.from('admins').select('id').eq('id', user.id).maybeSingle();
  if (!admin) return;

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
  // dispute never touched a payment record. When the outcome is "refund
  // the customer", do it as part of the same action instead of requiring
  // a second trip to the Payments ledger.
  if (alsoRefund && dispute?.job_id) {
    await adminClient
      .from('payments')
      .update({
        status: 'refunded',
        refund_reason: `Dispute resolution: ${note}`,
        overridden_by: admin.id,
        overridden_at: new Date().toISOString(),
      })
      .eq('job_id', dispute.job_id);
  }

  await logAdminAction(
    { id: user.id, email: user.email ?? '' },
    'RESOLVED_DISPUTE',
    { targetType: 'dispute', targetId: id, note: alsoRefund ? `${note} (refunded)` : note },
  );

  revalidatePath('/disputes');
  revalidatePath('/payments');
}
