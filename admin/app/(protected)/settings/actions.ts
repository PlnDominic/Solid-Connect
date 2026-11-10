'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner, createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/assert';

/** Owner-only: the support email is shown across the panel (this page, the
 * sidebar), so it is platform-wide policy rather than routine ops. */
export async function updatePlatformSettings(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const supportEmail = String(formData.get('support_email') ?? '').trim();
  if (!supportEmail || !/^\S+@\S+\.\S+$/.test(supportEmail)) return;

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('platform_config')
    .update({
      support_email: supportEmail,
      updated_at: new Date().toISOString(),
      updated_by: owner.id,
    })
    .eq('id', true);
  assertOk(error, 'Updating platform settings');

  await logAdminAction(owner, 'UPDATED_PLATFORM_SETTINGS', {
    targetType: 'platform_config',
    note: `Support email: ${supportEmail}`,
  });
  revalidatePath('/settings');
}

/** Owner-only: turns the provider subscription requirement on or off. While it
 * is off every provider can quote freely; when it is on, a provider whose free
 * job is used needs an active subscription to quote or accept direct requests
 * (enforced in the database, migration 0088). Turn it on only once providers
 * have a working way to pay. */
export async function updateSubscriptionRequired(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const required = String(formData.get('subscription_required')) === 'on';
  const { error } = await createAdminClient()
    .from('platform_config')
    .update({ subscription_required: required, updated_at: new Date().toISOString(), updated_by: owner.id })
    .eq('id', true);
  assertOk(error, 'Updating the subscription setting');

  await logAdminAction(owner, 'UPDATED_SUBSCRIPTION_REQUIRED', {
    targetType: 'platform_config',
    note: required ? 'Subscription now required' : 'Subscription no longer required',
  });
  revalidatePath('/settings');
}

/**
 * Physically deletes the storage objects run_data_retention_cleanup()
 * (0035) queued but couldn't delete itself - Supabase's storage.
 * protect_delete() trigger rejects a raw SQL `delete from
 * storage.objects`, specifically to stop a SQL statement from silently
 * orphaning a file at the storage layer, so the actual bytes only come
 * off through the real Storage API, which this JS client call goes
 * through properly. Owner-only: an irreversible bulk deletion, same tier
 * as team management.
 */
export async function purgeStorageQueue(): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const adminClient = createAdminClient();
  const { data: pending } = await adminClient
    .from('storage_purge_queue')
    .select('id, bucket_id, object_path')
    .is('purged_at', null);
  if (!pending || pending.length === 0) return;

  const byBucket = new Map<string, { ids: string[]; paths: string[] }>();
  for (const row of pending) {
    const bucket = byBucket.get(row.bucket_id) ?? { ids: [], paths: [] };
    bucket.ids.push(row.id);
    bucket.paths.push(row.object_path);
    byBucket.set(row.bucket_id, bucket);
  }

  let purgedCount = 0;
  for (const [bucketId, { ids, paths }] of byBucket) {
    const { error } = await adminClient.storage.from(bucketId).remove(paths);
    if (error) continue; // leave these queued - the next attempt will retry them
    const { error: markError } = await adminClient.from('storage_purge_queue').update({ purged_at: new Date().toISOString() }).in('id', ids);
    assertOk(markError, 'Recording purged files');
    purgedCount += ids.length;
  }

  await logAdminAction(owner, 'PURGED_STORAGE_QUEUE', { targetType: 'storage_purge_queue', note: `${purgedCount} file(s)` });
  revalidatePath('/settings');
}
