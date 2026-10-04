import { headers } from 'next/headers';

/** Public origin of this admin app, used to build auth redirect links that
 * land back here (invite / password-setup emails). ADMIN_SITE_URL wins when
 * set; otherwise it's derived from the incoming request so it works on any
 * deployment without extra config. Without an explicit redirect, Supabase
 * sends invitees to the project's Site URL - the mobile app - where an
 * admin invite has nothing to open. */
export async function adminSiteUrl(): Promise<string> {
  const configured = process.env.ADMIN_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export const ACCEPT_INVITE_PATH = '/auth/accept-invite';
