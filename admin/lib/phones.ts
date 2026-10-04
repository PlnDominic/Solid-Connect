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

export type Contact = { phone: string | null; email: string | null };

/**
 * Phone and email per profile id. Both columns are hidden from signed-in
 * users since 0073/0076, so this goes through admin_profile_contacts
 * (admins only). Before 0076 is applied, falls back to the phone-only
 * function plus a direct email read.
 */
export async function contactsFor(supabase: SupabaseClient, ids: (string | null | undefined)[]): Promise<Record<string, Contact>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return {};
  const out: Record<string, Contact> = {};
  const { data, error } = await supabase.rpc('admin_profile_contacts', { p_ids: unique });
  if (error?.code === 'PGRST202') {
    const [phones, { data: rows }] = await Promise.all([
      phonesFor(supabase, unique),
      supabase.from('profiles').select('id, email').in('id', unique),
    ]);
    for (const id of unique) out[id] = { phone: phones[id] ?? null, email: null };
    for (const r of (rows ?? []) as { id: string; email: string | null }[]) out[r.id] = { ...out[r.id], email: r.email };
    return out;
  }
  for (const row of (data ?? []) as { id: string; phone: string | null; email: string | null }[]) {
    out[row.id] = { phone: row.phone, email: row.email };
  }
  return out;
}

/** Adds `phone` and `email` to each profile row (null when unknown). */
export async function withContacts<T extends { id: string }>(supabase: SupabaseClient, rows: T[]): Promise<(T & Contact)[]> {
  const contacts = await contactsFor(supabase, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, phone: contacts[r.id]?.phone ?? null, email: contacts[r.id]?.email ?? null }));
}

/** Profile ids whose email contains the term or whose phone contains its
 * digits, for admin search and list filters. */
export async function idsByContact(supabase: SupabaseClient, term: string): Promise<string[]> {
  if (term.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('admin_profile_ids_by_contact', { p_term: term });
  if (error?.code === 'PGRST202') {
    const [byPhone, { data: rows }] = await Promise.all([
      idsByPhone(supabase, term),
      supabase.from('profiles').select('id').ilike('email', `%${term}%`).limit(500),
    ]);
    return [...new Set([...byPhone, ...((rows ?? []) as { id: string }[]).map((r) => r.id)])];
  }
  return ((data ?? []) as string[]).filter(Boolean);
}

/** An id.in(...) clause to OR into a PostgREST filter, or '' when none match. */
export function idMatchClause(ids: string[]): string {
  return ids.length ? `,id.in.(${ids.join(',')})` : '';
}
