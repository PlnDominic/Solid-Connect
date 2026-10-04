import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

/**
 * Every profiles column the app may read - all of them except `phone`,
 * which app users can't select since 0073 (a `select('*')` on profiles
 * now fails outright). A phone number comes only from contact_phone():
 * your own, or the other person's while you share an active job.
 * Add new profiles columns here once their migration grants them.
 */
export const PROFILE_COLUMNS =
  'id,role,full_name,initials,area,is_seed,provider_category,provider_rating,provider_jobs_count,provider_distance_km,provider_verified,provider_certified,created_at,email,push_token,push_permission_status,photo_url,tagline,verification_level,location,availability_mode,suspended_at,suspended_reason,suspended_by,terms_accepted_at,terms_version,notification_prefs,payout_account,customer_rating,customer_reviews_count';

/** A profiles row read with PROFILE_COLUMNS, typed as a Profile whose
 * phone is unknown (null) - use contact_phone() when a number is needed. */
export function asProfile(row: unknown): Profile {
  return { ...(row as object), phone: null } as Profile;
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

/** Adds the signed-in person's own phone to their profile row (the row
 * itself never carries it - see PROFILE_COLUMNS). */
export async function withOwnPhone<T extends { id: string }>(row: T): Promise<T & { phone: string | null }> {
  const phone = await fetchContactPhone(row.id).catch(() => null);
  return { ...row, phone };
}

/** The other person's phone, only while you share an active job (else null). */
export function useContactPhone(userId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['contactPhone', userId],
    enabled: !!userId && enabled,
    queryFn: () => fetchContactPhone(userId as string),
  });
}
