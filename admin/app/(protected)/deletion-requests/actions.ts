'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/assert';

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

  // The auth user may already be gone (a previous attempt partly succeeded).
  // Any other failure leaves the request pending so it is not shown as done.
  const { error: authError } = await adminClient.auth.admin.deleteUser(request.user_id);
  if (authError?.status !== 404) assertOk(authError, 'Removing the sign-in');
  const { error: anonymizeError } = await adminClient.rpc('anonymize_profile', { p_user_id: request.user_id });
  assertOk(anonymizeError, 'Removing profile details');

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
