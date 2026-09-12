'use server';

import { createServerSupabase } from '../../../lib/supabase';
import { createAdminClient } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

type ActionResult = { error?: string; success?: boolean; count?: number };

const AUDIENCES = ['customer', 'provider', 'everyone'] as const;

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

export async function sendBroadcast(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'Only signed-in admins can do this.' };

  const audience = String(formData.get('audience') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!AUDIENCES.includes(audience as (typeof AUDIENCES)[number])) return { error: 'Pick a valid audience.' };
  if (!title) return { error: 'Title is required.' };
  if (!body) return { error: 'Message body is required.' };

  const adminClient = createAdminClient();
  const profileQuery = adminClient.from('profiles').select('id');
  const { data: recipients, error: recipientsError } =
    audience === 'everyone' ? await profileQuery.in('role', ['customer', 'provider']) : await profileQuery.eq('role', audience);

  if (recipientsError) return { error: recipientsError.message };
  if (!recipients || recipients.length === 0) return { error: 'No matching recipients found.' };

  const rows = recipients.map((r) => ({
    user_id: r.id,
    type: 'ADMIN_BROADCAST',
    title,
    body,
    data: { sentBy: admin.email },
  }));

  const { error: insertError } = await adminClient.from('notifications').insert(rows);
  if (insertError) return { error: insertError.message };

  await logAdminAction(admin, 'SENT_BROADCAST', {
    targetType: 'notification',
    note: `To ${audience} (${rows.length} recipients): "${title}"`,
  });

  return { success: true, count: rows.length };
}
