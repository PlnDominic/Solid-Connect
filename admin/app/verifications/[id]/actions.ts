'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '../../../lib/admin';
import { createServerSupabase } from '../../../lib/supabase';

const LEVEL_BY_TYPE: Record<string, string> = {
  IDENTITY: 'IDENTITY_VERIFIED',
  PROFESSION: 'PROFESSION_VERIFIED',
  EXPERIENCE: 'EXPERIENCE_VERIFIED',
  SOLID_CONNECT: 'SOLID_CONNECT_VERIFIED',
};

export async function reviewVerification(id: string, decision: 'approved' | 'rejected', formData: FormData) {
  const note = String(formData.get('note') ?? '').trim();
  if (decision === 'rejected' && !note) return { error: 'A rejection reason is required.' };
  const sessionClient = await createServerSupabase();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) return { error: 'Your session has expired.' };
  const adminClient = createAdminClient();
  const { data: admin } = await adminClient.from('admins').select('id').eq('id', user.id).maybeSingle();
  if (!admin) return { error: 'This account cannot review submissions.' };
  const { data: submission } = await adminClient
    .from('provider_verifications')
    .select('provider_id,status,verification_type')
    .eq('id', id)
    .maybeSingle();
  if (!submission || submission.status !== 'pending') return { error: 'This submission has already been reviewed.' };
  const { error } = await adminClient
    .from('provider_verifications')
    .update({
      status: decision,
      note: decision === 'rejected' ? note : null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) return { error: error.message };
  if (decision === 'approved') {
    const vType = (submission as { verification_type?: string }).verification_type ?? 'IDENTITY';
    const level = LEVEL_BY_TYPE[vType] ?? 'IDENTITY_VERIFIED';
    const patch: Record<string, unknown> = {
      provider_verified: true,
      verification_level: level,
    };
    if (vType === 'SOLID_CONNECT') patch.provider_certified = true;
    const { error: profileError } = await adminClient.from('profiles').update(patch).eq('id', submission.provider_id);
    if (profileError) return { error: profileError.message };
  }
  revalidatePath('/verifications');
  revalidatePath(`/verifications/${id}`);
  return { success: true };
}
