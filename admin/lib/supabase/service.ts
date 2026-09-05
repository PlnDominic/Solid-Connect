import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client - bypasses RLS. Server-only: SUPABASE_SERVICE_ROLE_KEY
 * has no NEXT_PUBLIC_ prefix, so Next.js never bundles it to the browser.
 * Only ever call this from a Server Action or Route Handler, never from a
 * Client Component.
 */
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
