import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * profiles.phone isn't selectable by signed-in users since 0073 - not even
 * admins, who read profiles with their own session. These go through
 * admin-only database functions instead (they return nothing for a
 * non-admin).
 */
export async function phonesFor(supabase: SupabaseClient, ids: (string | null | undefined)[]): Promise<Record<string, string | null>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return {};
  const { data } = await supabase.rpc('admin_profile_phones', { p_ids: unique });
  const out: Record<string, string | null> = {};
  for (const row of (data ?? []) as { id: string; phone: string | null }[]) out[row.id] = row.phone;
  return out;
}

/** Adds `phone` to each profile row (null when unknown). */
export async function withPhones<T extends { id: string }>(supabase: SupabaseClient, rows: T[]): Promise<(T & { phone: string | null })[]> {
  const phones = await phonesFor(supabase, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, phone: phones[r.id] ?? null }));
}

/** Profile ids whose phone contains these digits, for admin search. */
export async function idsByPhone(supabase: SupabaseClient, term: string): Promise<string[]> {
  if (term.replace(/\D/g, '').length < 3) return [];
  const { data } = await supabase.rpc('admin_profile_ids_by_phone', { p_term: term });
  return ((data ?? []) as string[]).filter(Boolean);
}
