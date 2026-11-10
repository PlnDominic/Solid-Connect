'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/payments';

/** Takes a post off the board without deleting it (the customer still sees
 * it as closed, and the record stays for any report about it). */
export async function closeJobPost(id: string): Promise<void> {
  const admin = await requirePermission('accounts');
  if (!admin) return;

  const { error } = await createAdminClient().from('job_posts').update({ status: 'closed' }).eq('id', id).eq('status', 'open');
  assertOk(error, 'Closing the job post');

  await logAdminAction(admin, 'CLOSED_JOB_POST', { targetType: 'job_post', targetId: id });
  revalidatePath('/job-posts');
}

/** Permanently removes a post and the interest providers sent on it. */
export async function removeJobPost(id: string): Promise<void> {
  const admin = await requirePermission('accounts');
  if (!admin) return;

  const { error } = await createAdminClient().from('job_posts').delete().eq('id', id);
  assertOk(error, 'Removing the job post');

  await logAdminAction(admin, 'REMOVED_JOB_POST', { targetType: 'job_post', targetId: id });
  revalidatePath('/job-posts');
}
