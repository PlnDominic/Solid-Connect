import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

/**
 * Every profiles column the app may read - all of them except `phone`
 * (0073), `payout_account` (0075), `email` and `push_token` (0076), which
 * app users can't select (so a `select('*')` on profiles now fails
 * outright). Your own phone, email and push token come from
 * my_private_profile() (see withOwnPrivate); the other person's phone only
 * from contact_phone(), while you share an active job; a provider's own
 * payout account from my_payout_account() (see usePayoutAccount).
 * Add new profiles columns here once their migration grants them.
 */
export const PROFILE_COLUMNS =
  'id,role,full_name,initials,area,is_seed,provider_category,provider_rating,provider_jobs_count,provider_distance_km,provider_verified,provider_certified,created_at,push_permission_status,photo_url,tagline,verification_level,location,availability_mode,suspended_at,suspended_reason,suspended_by,terms_accepted_at,terms_version,notification_prefs,customer_rating,customer_reviews_count';

/** A profiles row read with PROFILE_COLUMNS, typed as a Profile whose
 * phone is unknown (null) - use contact_phone() when a number is needed. */
export function asProfile(row: unknown): Profile {
  return { ...(row as object), phone: null, email: null, push_token: null } as Profile;
}

/** The phone number on `userId`'s profile, if the caller may see it, else null. */
export async function fetchContactPhone(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('contact_phone', { p_user_id: userId });
  if (error) {
    // Database not migrated to 0073 yet (no contact_phone function): the
    // column is still readable then, so read it the old way rather than
    // lose everyone's own number (sign-up would ask for it again).
    if (error.code === 'PGRST202') {
      const { data: row } = await supabase.from('profiles').select('phone').eq('id', userId).maybeSingle();
      const phone = (row as { phone?: string | null } | null)?.phone;
      return phone || null;
    }
    throw error;
  }
  return typeof data === 'string' && data ? data : null;
}

type PrivateFields = { phone: string | null; email: string | null; push_token: string | null };

function asPrivateFields(data: unknown): Partial<PrivateFields> {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Partial<PrivateFields>;
    } catch {
      return {};
    }
  }
  if (typeof data === 'object') return data as Partial<PrivateFields>;
  return {};
}

async function fetchOwnPrivate(userId: string): Promise<PrivateFields> {
  // my_private_profile / contact_phone both key off auth.uid(). After a
  // fresh Google/Apple session, refresh the user so the JWT is definitely
  // on the client before those RPCs run - otherwise phone/email come back
  // empty and a finished account is forced through sign-up again.
  const { data: userData } = await supabase.auth.getUser();
  const authEmail = userData.user?.email?.trim() || null;

  const { data, error } = await supabase.rpc('my_private_profile');
  if (error?.code === 'PGRST202') {
    // Database not migrated to 0076 yet: email and push_token are still
    // readable directly; phone has its own fallback (fetchContactPhone).
    const phone = await fetchContactPhone(userId);
    const { data: row, error: rowError } = await supabase
      .from('profiles')
      .select('email,push_token')
      .eq('id', userId)
      .maybeSingle();
    if (rowError) throw rowError;
    const r = (row ?? {}) as { email?: string | null; push_token?: string | null };
    return { phone, email: r.email ?? authEmail, push_token: r.push_token ?? null };
  }
  if (error) throw error;
  const d = asPrivateFields(data);
  let phone = typeof d.phone === 'string' && d.phone.trim() ? d.phone.trim() : null;
  const email =
    (typeof d.email === 'string' && d.email.trim() ? d.email.trim() : null) || authEmail;
  // If my_private_profile returned no row (or empty phone), contact_phone
  // still allows the signed-in user to read their own number.
  if (!phone) {
    phone = await fetchContactPhone(userId);
  }
  return {
    phone,
    email,
    push_token: typeof d.push_token === 'string' ? d.push_token : null,
  };
}

/**
 * Adds the signed-in person's own phone, email and push token to their
 * profile row (the row itself never carries them - see PROFILE_COLUMNS).
 * With `fallback` (the profile already in memory, after a save that
 * succeeded) a failed lookup keeps those values instead of throwing.
 */
export async function withOwnPrivate<T extends { id: string }>(
  row: T,
  fallback?: Partial<PrivateFields> | null,
): Promise<T & PrivateFields> {
  try {
    return { ...row, ...(await fetchOwnPrivate(row.id)) };
  } catch (e) {
    if (!fallback) throw e;
    return { ...row, phone: fallback.phone ?? null, email: fallback.email ?? null, push_token: fallback.push_token ?? null };
  }
}

/** The other person's phone, only while you share an active job (else null). */
export function useContactPhone(userId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['contactPhone', userId],
    enabled: !!userId && enabled,
    queryFn: () => fetchContactPhone(userId as string),
  });
}
