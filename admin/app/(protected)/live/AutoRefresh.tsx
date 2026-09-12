'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-fetches this server-rendered page on an interval so "live" locations
 * actually stay live without wiring a client-side Supabase Realtime
 * subscription into the admin app (which has none yet - every other page
 * here is refresh-on-navigation). router.refresh() re-runs the page's
 * server component in place, no full reload, no client state lost.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
