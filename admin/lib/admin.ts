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
 *
 * Prefer requirePermission() for anything scoped to one feature area -
 * this plain gate is really only correct for things every admin needs
 * regardless of scope, like CSV export or read-only pages with no
 * mutating action behind them.
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

/**
 * The feature scopes a support admin can be individually granted or
 * denied (0032_granular_admin_permissions.sql). Deliberately doesn't
 * include team management, the audit log, or the commission rate - those
 * stay owner-only and non-delegable, same as before this existed (see
 * requireOwner and settings/actions.ts's own comment on why).
 */
export const ADMIN_PERMISSIONS = [
  'verifications',
  'disputes',
  'payments',
  'payouts',
  'categories',
  'reviews',
  'accounts',
  'broadcast',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  verifications: 'Provider verifications',
  disputes: 'Disputes',
  payments: 'Payments',
  payouts: 'Payouts',
  categories: 'Categories',
  reviews: 'Reviews',
  accounts: 'Suspensions & deletion requests',
  broadcast: 'Broadcast',
};

/**
 * Confirms the signed-in caller is an active admin who holds the given
 * permission scope - an owner always passes (owners hold every scope
 * implicitly, never stored in the permissions column), a support admin
 * passes only if that scope is in their own admins.permissions array.
 * Same no-throw convention as requireOwner/requireAdmin, so every caller
 * treats "not permitted" as a plain no-op rather than needing its own
 * try/catch.
 */
export async function requirePermission(scope: AdminPermission): Promise<{ id: string; email: string } | null> {
  const sessionClient = await createServerSupabase();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user?.email) return null;
  const adminClient = createAdminClient();
  const { data: admin } = await adminClient
    .from('admins')
    .select('id, role, disabled_at, permissions')
    .eq('id', user.id)
    .maybeSingle();
  if (!admin || admin.disabled_at) return null;
  if (admin.role === 'owner') return { id: user.id, email: user.email };
  if (!(admin.permissions ?? []).includes(scope)) return null;
  return { id: user.id, email: user.email };
}
