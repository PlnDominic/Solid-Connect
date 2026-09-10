'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase-browser';

export default function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await createClient().auth.signOut();
    // Full navigation (not router.push) so the root layout's server-side
    // getUser() check re-runs fresh instead of serving a stale RSC render.
    window.location.assign('/login');
  }

  return (
    <button className="logout-btn" onClick={logout} disabled={pending} aria-label="Sign out" title="Sign out">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    </button>
  );
}
