'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { approveVerification, rejectVerification } from '@/lib/review-verification';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SupabaseVerificationRepo } from '@/lib/supabase-verification-repo';

async function currentAdminId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) throw new Error('Not signed in');
  const { data: adminRow } = await supabase.from('admins').select('id').eq('id', sub).maybeSingle();
  if (!adminRow) throw new Error('Not an admin');
  return sub;
}

export async function approveAction(formData: FormData) {
  const id = formData.get('id') as string;
  const adminId = await currentAdminId();
  const repo = new SupabaseVerificationRepo(createServiceClient());
  const result = await approveVerification(repo, id, adminId);
  if (!result.ok) throw new Error(result.error);
  revalidatePath('/verifications');
  redirect('/verifications');
}

export async function rejectAction(formData: FormData) {
  const id = formData.get('id') as string;
  const note = (formData.get('note') as string) ?? '';
  const adminId = await currentAdminId();
  const repo = new SupabaseVerificationRepo(createServiceClient());
  const result = await rejectVerification(repo, id, adminId, note);
  if (!result.ok) throw new Error(result.error);
  revalidatePath('/verifications');
  redirect('/verifications');
}
