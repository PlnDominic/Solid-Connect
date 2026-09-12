'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '../../lib/supabase';
import { createAdminClient } from '../../lib/admin';
import { logAdminAction } from '../../lib/audit';

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

/** Freezes a customer or provider account. Enforcement is minimal and
 * deliberate: the mobile app checks suspended_at once at app-launch
 * sign-in and force-signs-out with the reason shown - not an instant,
 * mid-session kick, and not an RLS lockout threaded through every table.
 * See 0026_review_moderation_and_suspension.sql. */
export async function suspendProfile(id: string, redirectPath: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) return;

  const adminClient = createAdminClient();
  await adminClient
    .from('profiles')
    .update({ suspended_at: new Date().toISOString(), suspended_reason: reason, suspended_by: admin.id })
    .eq('id', id);

  await logAdminAction(admin, 'SUSPENDED_ACCOUNT', { targetType: 'profile', targetId: id, note: reason });
  revalidatePath(redirectPath);
}

export async function unsuspendProfile(id: string, redirectPath: string): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const adminClient = createAdminClient();
  await adminClient
    .from('profiles')
    .update({ suspended_at: null, suspended_reason: null, suspended_by: null })
    .eq('id', id);

  await logAdminAction(admin, 'UNSUSPENDED_ACCOUNT', { targetType: 'profile', targetId: id });
  revalidatePath(redirectPath);
}
