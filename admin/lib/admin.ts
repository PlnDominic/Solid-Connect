import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Admin service credentials are not configured.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Confirms the signed-in caller (via their own cookie session, not a
 * client-supplied id) is an active, 'owner'-role admin, for actions that
 * only owners may take: managing the admin team, reading the audit log.
 * Returns null (never throws) so callers can treat "not an owner" as a
 * plain no-op, matching this codebase's existing action-auth convention
 * (see resolveDispute, reviewVerification).
 */
export async function requireOwner(): Promise<{ id: string; email: string } | null> {
  const sessionClient = await createServerSupabase();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user?.email) return null;
  const adminClient = createAdminClient();
  const { data: admin } = await adminClient
    .from('admins')
    .select('id, role, disabled_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!admin || admin.disabled_at || admin.role !== 'owner') return null;
  return { id: user.id, email: user.email };
}

/**
 * Confirms the signed-in caller is any active (non-disabled) admin -
 * owner or support. Used by actions and export routes that any admin may
 * use, as opposed to requireOwner's owner-only gate. Same no-throw
 * convention as requireOwner.
 */
export async function requireAdmin(): Promise<{ id: string; email: string } | null> {
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
