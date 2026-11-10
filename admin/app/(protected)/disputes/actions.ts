'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/assert';

export async function resolveDispute(id: string, formData: FormData): Promise<void> {
  const note = String(formData.get('note') ?? '').trim();
  if (!note) return;

  const admin = await requirePermission('disputes');
  if (!admin) return;

  // Solid Connect holds no payment, so there is nothing to refund: a dispute
  // is resolved with a written outcome (and any action on accounts is taken
  // from the person's profile page).
  const adminClient = createAdminClient();
  const { data: dispute, error: disputeError } = await adminClient.from('disputes').select('status').eq('id', id).maybeSingle();
  assertOk(disputeError, 'Reading the dispute');
  if (!dispute || dispute.status !== 'open') return;

  const { error: resolveError } = await adminClient
    .from('disputes')
    .update({ status: 'resolved', resolution_note: note, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open');
  assertOk(resolveError, 'Resolving the dispute');

  await logAdminAction(admin, 'RESOLVED_DISPUTE', { targetType: 'dispute', targetId: id, note });

  revalidatePath('/disputes');
}
