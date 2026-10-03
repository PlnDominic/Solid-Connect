'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner, createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/payments';

/** Owner-only: the commission rate is a platform-wide revenue policy, not
 * routine ops work, so it gets the same gate as admin-team management
 * rather than the any-admin gate categories/disputes/reviews use. */
export async function updateCommission(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const raw = Number(formData.get('commission_percent'));
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return;

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('platform_config')
    .update({ commission_percent: raw, updated_at: new Date().toISOString(), updated_by: owner.id })
    .eq('id', true);
  assertOk(error, 'Updating the commission rate');

  await logAdminAction(owner, 'UPDATED_COMMISSION', { targetType: 'platform_config', note: `Set to ${raw}%` });
  revalidatePath('/settings');
}

/** Owner-only, same tier as commission: how much of the price a customer
 * pays Solid Connect up front to secure a booking, and what share of a
 * forfeited deposit (customer cancelled after paying it) goes to the
 * provider. A 0% deposit turns deposits off - one payment, as before. Only
 * affects bookings made after the change (see 0065). */
export async function updateDepositPolicy(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const deposit = Number(formData.get('deposit_percent'));
  const compensation = Number(formData.get('cancel_compensation_percent'));
  const valid = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
  if (!valid(deposit) || !valid(compensation)) return;

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('platform_config')
    .update({
      deposit_percent: deposit,
      cancel_compensation_percent: compensation,
      updated_at: new Date().toISOString(),
      updated_by: owner.id,
    })
    .eq('id', true);
  assertOk(error, 'Updating the deposit policy');

  await logAdminAction(owner, 'UPDATED_DEPOSIT_POLICY', {
    targetType: 'platform_config',
    note: `Deposit ${deposit}%, provider share of a forfeited deposit ${compensation}%`,
  });
  revalidatePath('/settings');
}

const PAYOUT_METHODS = ['', 'MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money', 'Bank transfer'] as const;

/** Owner-only, same tier as the commission rate: the support email is
 * shown across the panel (this page, the sidebar) and the default payout
 * method pre-selects the dropdown every "Mark paid" action on /payouts
 * starts from, so both are platform-wide policy rather than routine ops. */
export async function updatePlatformSettings(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const supportEmail = String(formData.get('support_email') ?? '').trim();
  const defaultPayoutMethod = String(formData.get('default_payout_method') ?? '');
  if (!supportEmail || !/^\S+@\S+\.\S+$/.test(supportEmail)) return;
  if (!PAYOUT_METHODS.includes(defaultPayoutMethod as (typeof PAYOUT_METHODS)[number])) return;

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('platform_config')
    .update({
      support_email: supportEmail,
      default_payout_method: defaultPayoutMethod || null,
      updated_at: new Date().toISOString(),
      updated_by: owner.id,
    })
    .eq('id', true);
  assertOk(error, 'Updating platform settings');

  await logAdminAction(owner, 'UPDATED_PLATFORM_SETTINGS', {
    targetType: 'platform_config',
    note: `Support email: ${supportEmail}; default payout method: ${defaultPayoutMethod || 'none'}`,
  });
  revalidatePath('/settings');
  revalidatePath('/payouts');
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
    const { error: markError } = await adminClient.from('storage_purge_queue').update({ purged_at: new Date().toISOString() }).in('id', ids);
    assertOk(markError, 'Recording purged files');
    purgedCount += ids.length;
  }

  await logAdminAction(owner, 'PURGED_STORAGE_QUEUE', { targetType: 'storage_purge_queue', note: `${purgedCount} file(s)` });
  revalidatePath('/settings');
}
