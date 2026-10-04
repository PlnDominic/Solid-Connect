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
  if (user) return response;

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
