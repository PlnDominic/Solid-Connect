'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requireAdmin } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/payments';

/** Marks a safety alert as followed up. Open to every active admin, not a
 * scoped permission: an alert should never sit unanswered because the
 * admin who noticed it lacks a particular scope. */
export async function resolveSafetyAlert(id: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const note = String(formData.get('note') ?? '').trim();

  const { error } = await createAdminClient()
    .from('safety_alerts')
    .update({ status: 'resolved', admin_note: note || null, resolved_by: admin.id, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open');
  assertOk(error, 'Resolving the alert');

  await logAdminAction(admin, 'RESOLVED_SAFETY_ALERT', { targetType: 'safety_alert', targetId: id, note: note || undefined });

  revalidatePath('/safety');
}
