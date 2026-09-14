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

/**
 * Physically deletes the storage objects run_data_retention_cleanup()
 * (0035) queued but couldn't delete itself - Supabase's storage.
 * protect_delete() trigger rejects a raw SQL `delete from
 * storage.objects`, specifically to stop a SQL statement from silently
 * orphaning a file at the storage layer, so the actual bytes only come
 * off through the real Storage API, which this JS client call goes
 * through properly. Owner-only: an irreversible bulk deletion, same tier
 * as team management and the commission rate.
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
    await adminClient.from('storage_purge_queue').update({ purged_at: new Date().toISOString() }).in('id', ids);
    purgedCount += ids.length;
  }

  await logAdminAction(owner, 'PURGED_STORAGE_QUEUE', { targetType: 'storage_purge_queue', note: `${purgedCount} file(s)` });
  revalidatePath('/settings');
}
