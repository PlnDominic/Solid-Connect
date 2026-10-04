'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import { PasswordField } from '../../components/PasswordField';
import '../../login/polish.css';

type Stage = 'checking' | 'confirm' | 'set-password' | 'invalid';

/** Landing page for admin invite and setup-link emails.
 *
 * Supabase admin-generated links (invite, recovery) can't use PKCE, so they
 * come back with the session in the URL hash (#access_token=...). The
 * default @supabase/ssr browser client is PKCE-only and rejects that, so
 * this page reads the hash itself and installs the session - which also
 * writes the auth cookies the protected layout checks. A `token_hash`
 * query (the recommended invite email template) is only redeemed when the
 * person clicks Accept: email security scanners open links before people
 * do, and redeeming on load would let them burn the one-time token. The
 * invitee then picks a password, since an invited account starts without
 * one. */
function createInviteClient(): SupabaseClient {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    isSingleton: false,
    auth: { detectSessionInUrl: false },
  });
}

/** Supabase's wording for a spent or stale one-time link, made actionable. */
function friendlyLinkError(message: string): string {
  if (!message || /expired|invalid|not found/i.test(message)) return 'This link has expired or was already used - each link works only once.';
  return message;
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
  const [otp, setOtp] = useState<{ tokenHash: string; type: EmailOtpType } | null>(null);

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
          window.history.replaceState(null, '', window.location.pathname);
          if (!cancelled) { setOtp({ tokenHash, type }); setStage('confirm'); }
          return;
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
        setReason(friendlyLinkError(failure));
        setStage('invalid');
      }
    }
    establishSession();
    return () => { cancelled = true; };
  }, [client]);

  async function acceptInvite() {
    if (!otp) return;
    setPending(true);
    const { error: otpError } = await client.auth.verifyOtp({ token_hash: otp.tokenHash, type: otp.type });
    const { data: { user } } = await client.auth.getUser();
    setPending(false);
    if (otpError || !user) { setReason(friendlyLinkError(otpError?.message ?? '')); setStage('invalid'); return; }
    setEmail(user.email ?? '');
    setStage('set-password');
  }

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
        {stage === 'confirm' && (
          <>
            <h1 id="invite-title">You&apos;re invited.</h1>
            <p className="reference-subtitle">Accept to join the Solid Connect admin team<br />and set your password.</p>
            <button type="button" className="reference-submit" style={{ width: '100%' }} disabled={pending} onClick={acceptInvite}>{pending ? 'Accepting…' : 'Accept invite'}</button>
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
              <PasswordField label="New password" value={password} onChange={setPassword} minLength={8} autoFocus />
              <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} minLength={8} />
              <button className="reference-submit" disabled={pending}>{pending ? 'Saving…' : 'Set password and continue'}</button>
              {error && <p className="notice" role="alert">{error}</p>}
            </form>
          </>
        )}
      </section>
    </main>
  );
}
