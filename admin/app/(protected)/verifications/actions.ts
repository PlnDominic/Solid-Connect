'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requireAdmin } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

type BulkResult = { error?: string; success?: boolean; count?: number };

const LEVEL_BY_TYPE: Record<string, string> = {
  IDENTITY: 'IDENTITY_VERIFIED',
  PROFESSION: 'PROFESSION_VERIFIED',
  EXPERIENCE: 'EXPERIENCE_VERIFIED',
  SOLID_CONNECT: 'SOLID_CONNECT_VERIFIED',
};

/** Approves or rejects several pending submissions in one action.
 * Processed sequentially (not in parallel) - this only ever runs against
 * a small, admin-selected batch, and sequential writes are simpler to
 * reason about than partial-failure handling across concurrent ones. */
export async function bulkReviewVerifications(ids: string[], decision: 'approved' | 'rejected', reason: string): Promise<BulkResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'Only signed-in admins can do this.' };
  if (ids.length === 0) return { error: 'Nothing selected.' };
  if (decision === 'rejected' && !reason.trim()) return { error: 'A rejection reason is required for a bulk reject.' };

  const adminClient = createAdminClient();
  let count = 0;

  for (const id of ids) {
    const { data: submission } = await adminClient
      .from('provider_verifications')
      .select('provider_id, status, verification_type')
      .eq('id', id)
      .maybeSingle();
    if (!submission || submission.status !== 'pending') continue;

    const { error } = await adminClient
      .from('provider_verifications')
      .update({
        status: decision,
        note: decision === 'rejected' ? reason : null,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) continue;

    if (decision === 'approved') {
      const vType = submission.verification_type ?? 'IDENTITY';
      const level = LEVEL_BY_TYPE[vType] ?? 'IDENTITY_VERIFIED';
      const patch: Record<string, unknown> = { provider_verified: true, verification_level: level };
      if (vType === 'SOLID_CONNECT') patch.provider_certified = true;
      await adminClient.from('profiles').update(patch).eq('id', submission.provider_id);
    }

    count += 1;
  }

  if (count === 0) return { error: 'None of the selected submissions were still pending.' };

  await logAdminAction(admin, decision === 'approved' ? 'BULK_APPROVED_VERIFICATIONS' : 'BULK_REJECTED_VERIFICATIONS', {
    targetType: 'provider_verification',
    note: `${count} submission${count === 1 ? '' : 's'}${decision === 'rejected' ? `: ${reason}` : ''}`,
  });

  revalidatePath('/verifications');
  return { success: true, count };
}
