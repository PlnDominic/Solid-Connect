'use client';

import { useEffect, useState } from 'react';

export type AdminTheme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const COOKIE_KEY = 'admin-theme';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Single source of truth for the admin dashboard's dark/light preference.
 * The server (see app/layout.tsx) reads the `admin-theme` cookie and passes
 * the resolved value in as `initialTheme`, so the very first client render
 * matches the server-rendered HTML exactly - no hydration mismatch, no
 * flash. The cookie is the authority for what actually renders; a mount
 * effect below reconciles state with whatever `data-theme` ends up on
 * `<html>` (covering callers, like the Settings page, that don't have a
 * server-computed value to pass in and fall back to the `initialTheme`
 * default). `localStorage` is written alongside the cookie on every change
 * purely as a legacy/defensive backup - it is never read back to decide
 * the initial theme. Every UI that lets the user change theme (ThemeToggle,
 * the Settings page) shares this one read/write path instead of each
 * re-implementing it. */
export function useAdminTheme(initialTheme: AdminTheme = 'dark') {
  const [theme, setThemeState] = useState<AdminTheme>(initialTheme);

  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme') as AdminTheme | null;
    if (attr && attr !== theme) setThemeState(attr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTheme(next: AdminTheme) {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  return { theme, setTheme };
}
