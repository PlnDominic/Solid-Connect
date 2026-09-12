import { createAdminClient } from './admin';

/**
 * Records one admin action to admin_audit_log. Best-effort: a logging
 * failure never blocks or unwinds the action it's recording (there is no
 * caller that awaits-and-throws on this), matching the same
 * "audit trail, not a transaction guard" role this table plays everywhere
 * it's called from.
 */
export async function logAdminAction(
  admin: { id: string; email: string },
  action: string,
  opts?: { targetType?: string; targetId?: string; note?: string },
): Promise<void> {
  const adminClient = createAdminClient();
  await adminClient.from('admin_audit_log').insert({
    admin_id: admin.id,
    admin_email: admin.email,
    action,
    target_type: opts?.targetType ?? null,
    target_id: opts?.targetId ?? null,
    note: opts?.note ?? null,
  });
}
