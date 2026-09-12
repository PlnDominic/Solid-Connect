'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, requireOwner } from '../../../lib/admin';
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

  const { error: insertError } = await adminClient
    .from('admins')
    .insert({ id: invite.user.id, email, role, invited_by: owner.id });
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
  await adminClient.from('admins').update({ role }).eq('id', id);
  await logAdminAction(owner, 'CHANGED_ADMIN_ROLE', { targetType: 'admin', targetId: id, note: `Set role to ${role}` });
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
