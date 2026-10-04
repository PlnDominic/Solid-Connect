'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase-browser';
import '../login/polish.css';

const MIN_LENGTH = 8;

function LockIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }

/**
 * Landing page for the link in the reset-password email (sent from the
 * login page). The browser client exchanges the link's `?code=` for a
 * session on load - which only works in the browser that asked for the
 * email, since that's where the PKCE verifier lives. With a session, the
 * admin sets a new password and goes straight in.
 */
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''); const [pending, setPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, '&'));
    const described = params.get('error_description');
    if (described) { setLinkError(described.replace(/\+/g, ' ')); setStatus('invalid'); return; }
    // getSession waits for the client to finish exchanging the link's code.
    createClient().auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError || !data.session) { setLinkError(sessionError?.message ?? ''); setStatus('invalid'); return; }
      window.history.replaceState(null, '', '/reset-password');
      setStatus('ready');
    });
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters.`); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setPending(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setPending(false); return; }
    window.location.assign('/verifications');
  }

  if (status === 'checking') return <main className="login reference-login"><section className="reference-card" aria-busy="true"><img src="/logo.jpeg" alt="Solid Connect" className="reference-icon" width={96} height={96} /><p className="reference-subtitle">Checking your reset link…</p></section></main>;

  if (status === 'invalid') return <main className="login reference-login"><section className="reference-card" aria-labelledby="reset-title"><img src="/logo.jpeg" alt="Solid Connect" className="reference-icon" width={96} height={96} /><h1 id="reset-title">Link expired.</h1><p className="reference-subtitle">{linkError || 'This reset link is invalid, already used, or was opened in a different browser.'} Request a new one from the sign-in page.</p><a className="reference-submit reset-back-button reset-link-button" href="/login">Back to sign in</a></section></main>;

  return <main className="login reference-login"><section className="reference-card" aria-labelledby="reset-title"><img src="/logo.jpeg" alt="Solid Connect" className="reference-icon" width={96} height={96} /><h1 id="reset-title">Set a new password.</h1><p className="reference-subtitle">You&apos;ll be signed in once it&apos;s saved.</p><form onSubmit={save}><label className="reference-input"><LockIcon /><input name="password" value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" minLength={MIN_LENGTH} required autoFocus /></label><label className="reference-input"><LockIcon /><input name="confirm" value={confirm} onChange={event => setConfirm(event.target.value)} type="password" autoComplete="new-password" placeholder="Confirm new password" aria-label="Confirm new password" required /></label><p className="reset-hint">At least {MIN_LENGTH} characters.</p><button className="reference-submit" disabled={pending}>{pending ? 'Saving…' : 'Save and sign in'}</button>{error && <p className="notice" role="alert">{error}</p>}</form></section></main>;
}
