'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

/**
 * Actually carries out a deletion request: removes the real auth.users
 * row (SQL alone can't reach that - see 0030's anonymize_profile comment)
 * then anonymizes the profiles row via the SQL function so job/payment/
 * review rows tied to other people's accounts keep their accountability
 * history, same as removing a review only recalculates the rating rather
 * than deleting it.
 */
export async function completeAccountDeletion(id: string, formData: FormData): Promise<void> {
  const admin = await requirePermission('accounts');
  if (!admin) return;

  const adminClient = createAdminClient();
  const { data: request } = await adminClient
    .from('account_deletion_requests')
    .select('user_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!request || request.status !== 'pending') return;

  const note = String(formData.get('note') ?? '').trim();

  // Best-effort: the auth user may already be gone (e.g. a previous
  // attempt partially succeeded) - don't let that block anonymizing the
  // profile, which is the part that actually removes visible PII.
  await adminClient.auth.admin.deleteUser(request.user_id).catch(() => null);
  await adminClient.rpc('anonymize_profile', { p_user_id: request.user_id });

  await adminClient
    .from('account_deletion_requests')
    .update({
      status: 'completed',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      admin_note: note || null,
    })
    .eq('id', id);

  await logAdminAction(admin, 'COMPLETED_ACCOUNT_DELETION', {
    targetType: 'account_deletion_request',
    targetId: id,
    note: note || undefined,
  });

  revalidatePath('/deletion-requests');
}

/** Declines a request without deleting anything - the account stays as-is. */
export async function dismissAccountDeletion(id: string, formData: FormData): Promise<void> {
  const admin = await requirePermission('accounts');
  if (!admin) return;

  const note = String(formData.get('note') ?? '').trim();

  const { error } = await createAdminClient()
    .from('account_deletion_requests')
    .update({
      status: 'cancelled',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      admin_note: note || null,
    })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) return;

  await logAdminAction(admin, 'DISMISSED_ACCOUNT_DELETION_REQUEST', {
    targetType: 'account_deletion_request',
    targetId: id,
    note: note || undefined,
  });

  revalidatePath('/deletion-requests');
}
