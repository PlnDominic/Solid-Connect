'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase-browser';
import './polish.css';

function EyeIcon({ off = false }: { off?: boolean }) { return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z" />{!off && <circle cx="12" cy="12" r="2.2" />}{off && <path d="m4 4 16 16" />}</svg>; }
function MailIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 5 10-5" /></svg>; }

// 'forgot' asks for the email; 'sent' confirms without saying whether the
// address has an account (Supabase answers the same either way).
type Mode = 'signin' | 'forgot' | 'sent';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [pending, setPending] = useState(false); const [showPassword, setShowPassword] = useState(false);
  async function signIn(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); setPending(true); const { error: authError } = await createClient().auth.signInWithPassword({ email, password }); if (authError) { setError(authError.message); setPending(false); return; } window.location.assign('/verifications'); }
  async function sendReset(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); setPending(true); const { error: authError } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }); setPending(false); if (authError) { setError(authError.message); return; } setMode('sent'); }
  // Auth emails whose redirect isn't on Supabase's allow list fall back to
  // the project Site URL - this page. Hand their payload to the page that
  // can use it instead of silently showing the sign-in form: a PKCE
  // `?code=` belongs to the reset page; tokens, a token_hash or an error
  // in the link belong to the invite / setup page.
  useEffect(() => {
    const { search, hash } = window.location;
    const query = new URLSearchParams(search);
    const fragment = new URLSearchParams(hash.replace(/^#/, ''));
    if (query.get('code')) window.location.replace(`/reset-password${search}${hash}`);
    else if (fragment.get('access_token') || fragment.get('error') || query.get('token_hash') || query.get('error'))
      window.location.replace(`/auth/accept-invite${search}${hash}`);
  }, []);
  function switchMode(next: Mode) { setError(''); setPending(false); setMode(next); }
  const emailField = <label className="reference-input"><MailIcon /><input name="email" value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="Email" aria-label="Email" required /></label>;

  if (mode === 'sent') return <main className="login reference-login"><section className="reference-card" aria-labelledby="login-title"><img src="/logo.jpeg" alt="Solid Connect" className="reference-icon" width={96} height={96} /><h1 id="login-title">Check your email.</h1><p className="reference-subtitle">If <strong>{email.trim()}</strong> has an account, a link to set a new password is on its way. Open it in this browser.</p><button type="button" className="reference-submit reset-back-button" onClick={() => switchMode('signin')}>Back to sign in</button><p className="login-foot">No email? Check spam, or <button type="button" className="text-link" onClick={() => switchMode('forgot')}>send it again</button>.</p></section></main>;

  if (mode === 'forgot') return <main className="login reference-login"><section className="reference-card" aria-labelledby="login-title"><img src="/logo.jpeg" alt="Solid Connect" className="reference-icon" width={96} height={96} /><h1 id="login-title">Reset password.</h1><p className="reference-subtitle">Enter your admin email and we&apos;ll send<br />you a link to set a new password.</p><form onSubmit={sendReset}>{emailField}<button className="reference-submit" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button>{error && <p className="notice" role="alert">{error}</p>}</form><p className="login-foot"><button type="button" className="text-link" onClick={() => switchMode('signin')}>Back to sign in</button></p></section></main>;

  return <main className="login reference-login"><section className="reference-card" aria-labelledby="login-title"><img src="/logo.jpeg" alt="Solid Connect" className="reference-icon" width={96} height={96} /><h1 id="login-title">Admin access.</h1><p className="reference-subtitle">Sign in to manage verifications, disputes,<br />and platform operations.</p><form onSubmit={signIn}>{emailField}<label className="reference-input"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg><input name="password" value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" aria-label="Password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}><EyeIcon off={!showPassword} /></button></label><button type="button" className="forgot-link" onClick={() => switchMode('forgot')}>Forgot password?</button><button className="reference-submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>{error && <p className="notice" role="alert">{error}</p>}</form><p className="login-foot">Access is limited to provisioned administrators.</p></section></main>;
}
