import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers - runs under RLS as whichever admin is signed in via the
 * session cookie. Do not use this for the approve/reject write: that needs
 * the service-role client (see admin/lib/supabase/service.ts) so it can
 * update a row it doesn't own under RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that can't set cookies directly -
          // middleware.ts below refreshes the session on the next request.
        }
      },
    },
  });
}
