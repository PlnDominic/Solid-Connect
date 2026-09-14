'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requireOwner } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

type ActionResult = { error?: string; success?: boolean };

/** Owner-only, same tier as the commission rate: a platform-wide toggle
 * that changes what every user (or a slice of them) experiences, not
 * routine ops work. */
export async function createFlag(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  if (!owner) return { error: 'Only owners can manage feature flags.' };

  const key = String(formData.get('key') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return { error: 'Key must be lowercase letters, numbers, and underscores, starting with a letter.' };
  }

  const adminClient = createAdminClient();
  const { data: existing } = await adminClient.from('feature_flags').select('key').eq('key', key).maybeSingle();
  if (existing) return { error: `A flag named "${key}" already exists.` };

  const { error } = await adminClient.from('feature_flags').insert({
    key,
    description: description || null,
    enabled: false,
    rollout_percent: 0,
    updated_by: owner.id,
  });
  if (error) return { error: error.message };

  await logAdminAction(owner, 'CREATED_FEATURE_FLAG', { targetType: 'feature_flag', targetId: key });
  revalidatePath('/feature-flags');
  return { success: true };
}

export async function updateFlag(key: string, formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const enabled = formData.get('enabled') === 'on';
  const rolloutRaw = Number(formData.get('rollout_percent'));
  const rolloutPercent = Number.isFinite(rolloutRaw) ? Math.min(100, Math.max(0, Math.round(rolloutRaw))) : 0;

  const adminClient = createAdminClient();
  await adminClient
    .from('feature_flags')
    .update({ enabled, rollout_percent: rolloutPercent, updated_at: new Date().toISOString(), updated_by: owner.id })
    .eq('key', key);

  await logAdminAction(owner, 'UPDATED_FEATURE_FLAG', {
    targetType: 'feature_flag',
    targetId: key,
    note: `${enabled ? 'on' : 'off'} · ${rolloutPercent}% rollout`,
  });
  revalidatePath('/feature-flags');
}

export async function deleteFlag(key: string): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const adminClient = createAdminClient();
  await adminClient.from('feature_flags').delete().eq('key', key);

  await logAdminAction(owner, 'DELETED_FEATURE_FLAG', { targetType: 'feature_flag', targetId: key });
  revalidatePath('/feature-flags');
}
