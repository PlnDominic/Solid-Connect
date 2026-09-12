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
 * without digging into the audit log. */
export async function setPaymentStatus(id: string, status: string, reason: string): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  if (!VALID_STATUSES.includes(status)) return;

  const adminClient = createAdminClient();
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

  await logAdminAction(admin, 'OVERRODE_PAYMENT', {
    targetType: 'payment',
    targetId: id,
    note: `Set status to ${status}${status === 'refunded' && reason ? `: ${reason}` : ''}`,
  });

  revalidatePath('/payments');
}
