'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

/** Records that Solid Connect actually sent a provider their payout -
 * the second leg of the two-leg model, distinct from (and later than)
 * the payment being released. Requires a method; the reference is
 * optional since a manual bank transfer today might not have one until
 * a real gateway supplies it. */
export async function markPayoutPaid(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const method = String(formData.get('method') ?? '').trim();
  const reference = String(formData.get('reference') ?? '').trim();
  if (!method) return;

  const adminClient = createAdminClient();
  await adminClient
    .from('provider_payouts')
    .update({
      status: 'paid',
      payout_method: method,
      payout_reference: reference || null,
      paid_at: new Date().toISOString(),
      paid_by: admin.id,
    })
    .eq('id', id)
    .eq('status', 'pending');

  await logAdminAction(admin, 'MARKED_PAYOUT_PAID', {
    targetType: 'provider_payout',
    targetId: id,
    note: `${method}${reference ? ` · ${reference}` : ''}`,
  });

  revalidatePath('/payouts');
}
