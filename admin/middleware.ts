import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.rewrite(new URL('/access', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/login'] };
