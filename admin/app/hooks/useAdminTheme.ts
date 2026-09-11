'use client';

import { useEffect, useState } from 'react';

export type AdminTheme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const COOKIE_KEY = 'admin-theme';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readInitialTheme(): AdminTheme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' ? 'light' : 'dark';
}

/** Single source of truth for the admin dashboard's dark/light preference.
 * The server (see app/layout.tsx) reads the `admin-theme` cookie to render
 * the correct `data-theme` on first paint, avoiding a flash; this hook keeps
 * localStorage in sync too so the choice survives even if cookies are
 * cleared, and every UI that lets the user change theme (ThemeToggle,
 * the Settings page) shares this one read/write path instead of each
 * re-implementing it. */
export function useAdminTheme() {
  const [theme, setThemeState] = useState<AdminTheme>(readInitialTheme);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as AdminTheme | null;
    const attr = document.documentElement.getAttribute('data-theme') as AdminTheme | null;
    const initial = attr ?? stored ?? 'dark';
    setThemeState(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  function setTheme(next: AdminTheme) {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  return { theme, setTheme };
}
