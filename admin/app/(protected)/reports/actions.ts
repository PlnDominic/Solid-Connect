'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/payments';

/** Closes a user report. "Dismissed" means no action was needed;
 * "actioned" means the admin dealt with it (for example by suspending the
 * account from the person's profile page). Either way the reviewer and
 * their note are recorded. */
export async function resolveReport(id: string, decision: 'dismissed' | 'actioned', formData: FormData): Promise<void> {
  const admin = await requirePermission('accounts');
  if (!admin) return;
  if (decision !== 'dismissed' && decision !== 'actioned') return;

  const note = String(formData.get('note') ?? '').trim();

  const { error } = await createAdminClient()
    .from('user_reports')
    .update({ status: decision, admin_note: note || null, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open');
  assertOk(error, 'Closing the report');

  await logAdminAction(admin, decision === 'dismissed' ? 'DISMISSED_USER_REPORT' : 'ACTIONED_USER_REPORT', {
    targetType: 'user_report',
    targetId: id,
    note: note || undefined,
  });

  revalidatePath('/reports');
}
