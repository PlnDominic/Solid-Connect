'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/assert';
import { removePersonalData } from '../../../lib/accountDeletion';

/**
 * Actually carries out a deletion request: removes the person's ID, profile
 * and portfolio files, then the real auth.users
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

  // Any failure leaves the request pending so it is not shown as done, and
  // trying again is safe. Files go first, while the account is still intact.
  await removePersonalData(adminClient, request.user_id);
  // The auth user may already be gone (a previous attempt partly succeeded).
  const { error: authError } = await adminClient.auth.admin.deleteUser(request.user_id);
  if (authError?.status !== 404) assertOk(authError, 'Removing the sign-in');
  const { error: anonymizeError } = await adminClient.rpc('anonymize_profile', { p_user_id: request.user_id });
  assertOk(anonymizeError, 'Removing profile details');

  const { error: statusError } = await adminClient
    .from('account_deletion_requests')
    .update({
      status: 'completed',
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      admin_note: note || null,
    })
    .eq('id', id);
  assertOk(statusError, 'Marking the request completed');

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

/** Queues a request that arrived by email, so it is handled like an in-app
 * one. It only queues it: check the sender owns the account first. */
export async function addEmailedDeletionRequest(formData: FormData): Promise<void> {
  const admin = await requirePermission('accounts');
  if (!admin) return;

  const email = String(formData.get('email') ?? '').trim();
  if (!email) return;

  const adminClient = createAdminClient();
  const { data: matches, error: findError } = await adminClient
    .from('profiles')
    .select('id')
    // Case-insensitive exact match: %, _ and \ are not wildcards here.
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .limit(2);
  assertOk(findError, 'Finding the account');
  if (matches?.length !== 1) redirect(`/deletion-requests?added=${matches?.length ? 'several' : 'none'}`);
  const userId = matches[0].id;

  const { data: staff, error: staffError } = await adminClient.from('admins').select('id').eq('id', userId).maybeSingle();
  assertOk(staffError, 'Checking the account');
  if (staff) redirect('/deletion-requests?added=admin');

  const { data: created, error } = await adminClient
    .from('account_deletion_requests')
    .insert({ user_id: userId, reason: 'Received by email' })
    .select('id')
    .single();
  // 23505: this account already has a pending request.
  if (error?.code === '23505') redirect('/deletion-requests?added=pending');
  assertOk(error, 'Adding the request');

  await logAdminAction(admin, 'ADDED_EMAILED_DELETION_REQUEST', {
    targetType: 'account_deletion_request',
    targetId: created?.id,
  });
  revalidatePath('/deletion-requests');
  redirect('/deletion-requests?added=ok');
}
