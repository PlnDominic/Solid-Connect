'use server';

import { createAdminClient, requirePermission } from '../../../lib/admin';
import { logAdminAction } from '../../../lib/audit';

type ActionResult = { error?: string; success?: boolean; count?: number };

const AUDIENCES = ['customer', 'provider', 'everyone'] as const;

export async function sendBroadcast(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requirePermission('broadcast');
  if (!admin) return { error: 'Only signed-in admins can do this.' };

  const audience = String(formData.get('audience') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const isEssential = formData.get('essential') === 'on';

  if (!AUDIENCES.includes(audience as (typeof AUDIENCES)[number])) return { error: 'Pick a valid audience.' };
  if (!title) return { error: 'Title is required.' };
  if (!body) return { error: 'Message body is required.' };

  const adminClient = createAdminClient();
  let profileQuery = adminClient.from('profiles').select('id');
  profileQuery = audience === 'everyone' ? profileQuery.in('role', ['customer', 'provider']) : profileQuery.eq('role', audience);
  // Promotional broadcasts (the default) only reach users who opted in -
  // docs/legal/privacy-policy.md §2 promises "product announcements" are
  // opt-in. "Essential" bypasses this for operational notices (outages,
  // policy changes) that every user needs regardless of preference.
  if (!isEssential) profileQuery = profileQuery.eq('notification_prefs->>promotions', 'true');
  const { data: recipients, error: recipientsError } = await profileQuery;

  if (recipientsError) return { error: recipientsError.message };
  if (!recipients || recipients.length === 0) {
    return {
      error: isEssential
        ? 'No matching recipients found.'
        : 'No matching recipients have opted in to promotional notifications. Check "send regardless" for an operational notice.',
    };
  }

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
    note: `To ${audience}${isEssential ? ' (essential, bypassed opt-out)' : ' (opted-in only)'} (${rows.length} recipients): "${title}"`,
  });

  return { success: true, count: rows.length };
}
