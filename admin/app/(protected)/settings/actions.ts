'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner, createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

/** Owner-only: the commission rate is a platform-wide revenue policy, not
 * routine ops work, so it gets the same gate as admin-team management
 * rather than the any-admin gate categories/disputes/reviews use. */
export async function updateCommission(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const raw = Number(formData.get('commission_percent'));
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return;

  const adminClient = createAdminClient();
  await adminClient
    .from('platform_config')
    .update({ commission_percent: raw, updated_at: new Date().toISOString(), updated_by: owner.id })
    .eq('id', true);

  await logAdminAction(owner, 'UPDATED_COMMISSION', { targetType: 'platform_config', note: `Set to ${raw}%` });
  revalidatePath('/settings');
}
