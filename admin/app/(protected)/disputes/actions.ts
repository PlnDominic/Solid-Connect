'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '../../../lib/admin';
import { createServerSupabase } from '../../../lib/supabase';
import { logAdminAction } from '../../../lib/audit';

export async function resolveDispute(id: string, formData: FormData): Promise<void> {
  const note = String(formData.get('note') ?? '').trim();
  if (!note) return;

  const sessionClient = await createServerSupabase();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return;

  const adminClient = createAdminClient();
  const { data: admin } = await adminClient.from('admins').select('id').eq('id', user.id).maybeSingle();
  if (!admin) return;

  await adminClient
    .from('disputes')
    .update({
      status: 'resolved',
      resolution_note: note,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'open');

  await logAdminAction(
    { id: user.id, email: user.email ?? '' },
    'RESOLVED_DISPUTE',
    { targetType: 'dispute', targetId: id, note },
  );

  revalidatePath('/disputes');
}
