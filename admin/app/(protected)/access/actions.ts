'use server';

import { revalidatePath } from 'next/cache';
import { ADMIN_PERMISSIONS, createAdminClient, requireOwner, type AdminPermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

type ActionResult = { error?: string; success?: boolean };

const VALID_ROLES = ['owner', 'support'];

/** Owner-only: invites a new admin by email (sends a real Supabase Auth
 * invite email) and provisions their `admins` row immediately, so access
 * is in place as soon as they accept. */
export async function inviteAdmin(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();
  if (!owner) return { error: 'Only owners can invite admins.' };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'support');
  if (!email) return { error: 'Email is required.' };
  if (!VALID_ROLES.includes(role)) return { error: 'Invalid role.' };

  const adminClient = createAdminClient();

  const { data: existing } = await adminClient.from('admins').select('id').eq('email', email).maybeSingle();
  if (existing) return { error: 'This email is already an admin.' };

  const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invite?.user) {
    return { error: inviteError?.message ?? 'Could not send the invite.' };
  }

  // A new support admin defaults to every scope - matching what "support"
  // has always meant up to now - so nobody's invite silently leaves them
  // unable to do anything; an owner narrows specific admins down
  // afterward from this same page.
  const { error: insertError } = await adminClient
    .from('admins')
    .insert({ id: invite.user.id, email, role, invited_by: owner.id, permissions: role === 'support' ? [...ADMIN_PERMISSIONS] : [] });
  if (insertError) return { error: insertError.message };

  await logAdminAction(owner, 'INVITED_ADMIN', { targetType: 'admin', targetId: invite.user.id, note: `Invited ${email} as ${role}` });
  revalidatePath('/access');
  return { success: true };
}

/** Owner-only: changes another admin's role. */
export async function setAdminRole(id: string, formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;
  const role = String(formData.get('role') ?? '');
  if (!VALID_ROLES.includes(role)) return;

  const adminClient = createAdminClient();
  const patch: Record<string, unknown> = { role };
  // A former owner demoted to support had no permissions row (owners
  // never store any - see inviteAdmin) - default them to every scope
  // instead of a silent full lockout, the same reasoning inviteAdmin
  // already uses for a brand new support admin.
  if (role === 'support') {
    const { data: current } = await adminClient.from('admins').select('permissions').eq('id', id).maybeSingle();
    if (!current?.permissions?.length) patch.permissions = [...ADMIN_PERMISSIONS];
  }
  await adminClient.from('admins').update(patch).eq('id', id);
  await logAdminAction(owner, 'CHANGED_ADMIN_ROLE', { targetType: 'admin', targetId: id, note: `Set role to ${role}` });
  revalidatePath('/access');
}

/** Owner-only: sets exactly which feature scopes a support admin holds -
 * see ADMIN_PERMISSIONS for the list and requirePermission() for how each
 * scope is actually enforced. A no-op for an owner-role target (owners
 * hold every scope implicitly and never read this column). */
export async function setAdminPermissions(id: string, formData: FormData): Promise<void> {
  const owner = await requireOwner();
  if (!owner) return;

  const granted = ADMIN_PERMISSIONS.filter((p) => formData.get(p) === 'on') as AdminPermission[];

  const adminClient = createAdminClient();
  const { data: target } = await adminClient.from('admins').select('role').eq('id', id).maybeSingle();
  if (!target || target.role !== 'support') return;

  await adminClient.from('admins').update({ permissions: granted }).eq('id', id);
  await logAdminAction(owner, 'CHANGED_ADMIN_PERMISSIONS', {
    targetType: 'admin',
    targetId: id,
    note: granted.length ? granted.join(', ') : 'none',
  });
  revalidatePath('/access');
}

/** Owner-only: soft-disables or re-enables another admin. Disabling revokes
 * access everywhere is_admin() gates (see 0025_admin_roles_audit.sql) - not
 * just this app's login redirect. An owner can never disable themself. */
export async function setAdminDisabled(id: string, disabled: boolean): Promise<void> {
  const owner = await requireOwner();
  if (!owner || id === owner.id) return;

  const adminClient = createAdminClient();
  await adminClient.from('admins').update({ disabled_at: disabled ? new Date().toISOString() : null }).eq('id', id);
  await logAdminAction(owner, disabled ? 'DISABLED_ADMIN' : 'ENABLED_ADMIN', { targetType: 'admin', targetId: id });
  revalidatePath('/access');
}
