import type { SupabaseClient } from '@supabase/supabase-js';
import { assertOk } from './assert';

/** Files that are only about the account holder. Request, chat, voice and
 * dispute files stay: the other person or a dispute may need them. Keep the
 * public /account-deletion page and docs/legal/privacy-policy.md in step. */
export const PERSONAL_BUCKETS = ['verification-docs', 'profile-photos', 'portfolio-photos'] as const;

const PAGE = 100;

/** Removes the person's files (each bucket stores them under their user id),
 * the rows pointing at them, and the personal data anonymize_profile (0030)
 * does not reach. Throws on any failure; safe to run again. */
export async function removePersonalData(client: SupabaseClient, userId: string): Promise<void> {
  // An empty id would list the whole bucket.
  if (!userId) throw new Error('Removing personal data failed: no account id.');

  for (const bucket of PERSONAL_BUCKETS) {
    const storage = client.storage.from(bucket);
    for (;;) {
      const { data: files, error } = await storage.list(userId, { limit: PAGE });
      assertOk(error, `Listing ${bucket}`);
      if (!files?.length) break;
      const { data: removed, error: removeError } = await storage.remove(files.map((f) => `${userId}/${f.name}`));
      assertOk(removeError, `Removing ${bucket}`);
      // Nothing removed would list the same files forever.
      if (!removed?.length) throw new Error(`Removing ${bucket} failed: no files were removed.`);
    }
  }

  const { error: portfolioError } = await client.from('provider_portfolio_photos').delete().eq('provider_id', userId);
  assertOk(portfolioError, 'Removing portfolio entries');
  const { error: docsError } = await client.from('provider_verifications').update({ doc_urls: [] }).eq('provider_id', userId);
  assertOk(docsError, 'Clearing verification document links');

  // The copy of name, email, phone and photo link made by 0011.
  const { error: userError } = await client
    .from('users')
    .update({ email: null, phone: null, first_name: null, last_name: null, avatar_url: null, status: 'DISABLED' })
    .eq('auth_user_id', userId);
  assertOk(userError, 'Clearing the user record');
  const { error: presenceError } = await client.from('provider_presence').delete().eq('provider_id', userId);
  assertOk(presenceError, 'Removing the map location');
}
