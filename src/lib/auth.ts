import { supabase } from './supabase';

/** One anonymous identity per device install — the prototype's "Demo mode". */
export async function ensureAnonymousSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!signInData.user) throw new Error('Anonymous sign-in returned no user');
  return signInData.user.id;
}
