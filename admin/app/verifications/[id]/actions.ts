'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '../../../lib/admin';
import { createServerSupabase } from '../../../lib/supabase';

export async function reviewVerification(id: string, decision: 'approved' | 'rejected', formData: FormData) {
  const note = String(formData.get('note') ?? '').trim();
  if (decision === 'rejected' && !note) return { error: 'A rejection reason is required.' };
  const sessionClient = await createServerSupabase(); const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return { error: 'Your session has expired.' };
  const adminClient = createAdminClient(); const { data: admin } = await adminClient.from('admins').select('id').eq('id', user.id).maybeSingle();
  if (!admin) return { error: 'This account cannot review submissions.' };
  const { data: submission } = await adminClient.from('provider_verifications').select('provider_id,status').eq('id', id).maybeSingle();
  if (!submission || submission.status !== 'pending') return { error: 'This submission has already been reviewed.' };
  const { error } = await adminClient.from('provider_verifications').update({ status: decision, note: decision === 'rejected' ? note : null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending');
  if (error) return { error: error.message };
  if (decision === 'approved') { const { error: profileError } = await adminClient.from('profiles').update({ provider_verified: true }).eq('id', submission.provider_id); if (profileError) return { error: profileError.message }; }
  revalidatePath('/verifications'); revalidatePath(`/verifications/${id}`); return { success: true };
}
