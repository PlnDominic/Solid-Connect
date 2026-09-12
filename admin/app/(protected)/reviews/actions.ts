'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '../../../lib/supabase';
import { createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

async function requireAdmin(): Promise<{ id: string; email: string } | null> {
  const sessionClient = await createServerSupabase();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user?.email) return null;
  const adminClient = createAdminClient();
  const { data: admin } = await adminClient.from('admins').select('id, disabled_at').eq('id', user.id).maybeSingle();
  if (!admin || admin.disabled_at) return null;
  return { id: user.id, email: user.email };
}

/** Hides or restores a review, keeping the provider's running-average
 * rating/jobs-count (see apply_review() in 0001_init.sql) in sync either
 * way - removing or restoring one review's contribution to a plain
 * average is commutative, so this works regardless of insertion order. */
export async function setReviewHidden(id: string, hidden: boolean): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const adminClient = createAdminClient();
  const { data: review } = await adminClient.from('reviews').select('id, rating, provider_id, hidden_at').eq('id', id).maybeSingle();
  if (!review) return;
  if (hidden === !!review.hidden_at) return; // already in the requested state

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
    await adminClient
      .from('profiles')
      .update({ provider_jobs_count: newCount, provider_rating: newRating })
      .eq('id', review.provider_id);
  }

  await adminClient
    .from('reviews')
    .update({ hidden_at: hidden ? new Date().toISOString() : null, hidden_by: hidden ? admin.id : null })
    .eq('id', id);

  await logAdminAction(admin, hidden ? 'HID_REVIEW' : 'UNHID_REVIEW', { targetType: 'review', targetId: id });
  revalidatePath('/reviews');
}
