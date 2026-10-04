'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import '../../login/polish.css';

type Stage = 'checking' | 'set-password' | 'invalid';

/** Landing page for admin invite and setup-link emails.
 *
 * Supabase admin-generated links (invite, recovery) can't use PKCE, so they
 * come back with the session in the URL hash (#access_token=...). The
 * default @supabase/ssr browser client is PKCE-only and rejects that, so
 * this page reads the hash itself and installs the session - which also
 * writes the auth cookies the protected layout checks. A `token_hash`
 * query (custom email templates) is verified the same way. The invitee
 * then picks a password, since an invited account starts without one. */
function createInviteClient(): SupabaseClient {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    isSingleton: false,
    auth: { detectSessionInUrl: false },
  });
}

export default function AcceptInvitePage() {
  const [client] = useState(createInviteClient);
  const [stage, setStage] = useState<Stage>('checking');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function establishSession() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search);
      const linkError = hash.get('error_description') ?? query.get('error_description');

      let failure = linkError ? linkError.replaceAll('+', ' ') : '';
      if (!failure) {
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const tokenHash = query.get('token_hash');
        const type = query.get('type') as EmailOtpType | null;
        if (accessToken && refreshToken) {
          const { error: sessionError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) failure = sessionError.message;
        } else if (tokenHash && type) {
          const { error: otpError } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
          if (otpError) failure = otpError.message;
        }
      }
      // Keep tokens out of the address bar and browser history.
      window.history.replaceState(null, '', window.location.pathname);

      const { data: { user } } = await client.auth.getUser();
      if (cancelled) return;
      if (user) {
        setEmail(user.email ?? '');
        setStage('set-password');
      } else {
        setReason(failure || 'This link is invalid or has already been used.');
        setStage('invalid');
      }
    }
    establishSession();
    return () => { cancelled = true; };
  }, [client]);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setPending(true);
    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setPending(false); return; }
    window.location.assign('/analytics');
  }

  return (
    <main className="login reference-login">
      <section className="reference-card" aria-labelledby="invite-title">
        <img src="/logo.jpeg" alt="Solid Connect" className="reference-icon" width={88} height={88} />
        {stage === 'checking' && (
          <>
            <h1 id="invite-title">Checking your invite…</h1>
            <p className="reference-subtitle">One moment while we confirm your link.</p>
          </>
        )}
        {stage === 'invalid' && (
          <>
            <h1 id="invite-title">Link not valid.</h1>
            <p className="reference-subtitle">{reason}</p>
            <p className="notice" role="alert">Invite links work once and expire. Ask an owner to send you a new setup link from the Team page.</p>
            <a className="reference-submit" href="/login" style={{ display: 'grid', placeItems: 'center', marginTop: 20 }}>Go to sign in</a>
          </>
        )}
        {stage === 'set-password' && (
          <>
            <h1 id="invite-title">Welcome aboard.</h1>
            <p className="reference-subtitle">Set a password for <strong>{email}</strong><br />to finish setting up your admin access.</p>
            <form onSubmit={savePassword}>
              <label className="reference-input">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="New password" aria-label="New password" required minLength={8} />
              </label>
              <label className="reference-input">
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Confirm password" aria-label="Confirm password" required minLength={8} />
              </label>
              <button className="reference-submit" disabled={pending}>{pending ? 'Saving…' : 'Set password and continue'}</button>
              {error && <p className="notice" role="alert">{error}</p>}
            </form>
          </>
        )}
      </section>
    </main>
  );
}
