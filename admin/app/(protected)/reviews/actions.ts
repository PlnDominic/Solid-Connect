'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';
import { assertOk } from '../../../lib/payments';

/** Hides or restores a review, keeping the provider's running-average
 * rating/jobs-count (see apply_review() in 0001_init.sql) in sync either
 * way - removing or restoring one review's contribution to a plain
 * average is commutative, so this works regardless of insertion order. */
export async function setReviewHidden(id: string, hidden: boolean): Promise<void> {
  const admin = await requirePermission('reviews');
  if (!admin) return;

  const adminClient = createAdminClient();
  const { data: review } = await adminClient.from('reviews').select('id, rating, provider_id, hidden_at').eq('id', id).maybeSingle();
  if (!review) return;
  if (hidden === !!review.hidden_at) return; // already in the requested state

  const { error: reviewError } = await adminClient
    .from('reviews')
    .update({ hidden_at: hidden ? new Date().toISOString() : null, hidden_by: hidden ? admin.id : null })
    .eq('id', id);
  assertOk(reviewError, 'Updating the review');

  const { data: provider } = await adminClient
    .from('profiles')
    .select('provider_rating, provider_jobs_count')
    .eq('id', review.provider_id)
    .maybeSingle();

  if (provider) {
    const currentSum = provider.provider_rating * provider.provider_jobs_count;
    const newCount = hidden ? Math.max(provider.provider_jobs_count - 1, 0) : provider.provider_jobs_count + 1;
    const newSum = hidden ? currentSum - review.rating : currentSum + review.rating;
    const newRating = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0;
    const { error: ratingError } = await adminClient
      .from('profiles')
      .update({ provider_jobs_count: newCount, provider_rating: newRating })
      .eq('id', review.provider_id);
    if (ratingError) {
      // Put the review back so it and the provider's rating stay in step.
      await adminClient.from('reviews').update({ hidden_at: review.hidden_at, hidden_by: null }).eq('id', id);
      assertOk(ratingError, 'Recalculating the provider rating');
    }
  }

  await logAdminAction(admin, hidden ? 'HID_REVIEW' : 'UNHID_REVIEW', { targetType: 'review', targetId: id });
  revalidatePath('/reviews');
}
