import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Defence in depth: every admin route except the pages reached signed
// out - login, reset-password, the /auth/* invite landing (which signs the
// user in from the link itself) and the public /legal documents - requires
// a valid Supabase session before any page or server action code runs.
// Whether that user is an active admin (and holds the right scope) is
// still enforced in the protected layout and in each action's guard.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Second factor. Off until ADMIN_REQUIRE_MFA=true so enabling it is a
    // deliberate step taken after the admins have an authenticator app.
    // Every protected page, server action and API route sits behind this
    // check; /mfa itself is the only page reachable at the first level.
    if (process.env.ADMIN_REQUIRE_MFA === 'true' && !request.nextUrl.pathname.startsWith('/mfa')) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.currentLevel !== 'aal2') {
        if (request.nextUrl.pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Two-step verification required' }, { status: 401 });
        }
        const mfaUrl = request.nextUrl.clone();
        mfaUrl.pathname = '/mfa';
        mfaUrl.search = '';
        return NextResponse.redirect(mfaUrl);
      }
    }
    return response;
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!login|reset-password|auth/|legal|_next/static|_next/image|favicon.ico|logo\.jpeg|.*\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};
