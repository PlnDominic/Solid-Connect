'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '../../lib/supabase-browser';
import './polish.css';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithPassword({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    if (authError) { setError(authError.message); setPending(false); return; }
    window.location.assign('/verifications');
  }

  return (
    <main className="login reference-login">
      <div className="sky-glow" aria-hidden="true" />
      <header className="reference-brand"><span className="brand-symbol">✦</span><strong>Ebolt</strong></header>
      <section className="reference-card" aria-labelledby="login-title">
        <div className="reference-icon" aria-hidden="true">↪</div>
        <h1 id="login-title">Sign in with email</h1>
        <p className="reference-subtitle">Access your operations workspace<br />and keep every decision moving.</p>
        <form onSubmit={signIn}>
          <label className="reference-input"><span aria-hidden="true">✉</span><input name="email" type="email" autoComplete="email" placeholder="Email" aria-label="Email" required /></label>
          <label className="reference-input"><span aria-hidden="true">▣</span><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" aria-label="Password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? '◉' : '◌'}</button></label>
          <a className="forgot-link" href="mailto:support@solidconnect.co?subject=Admin%20password%20reset">Forgot password?</a>
          <button className="reference-submit" disabled={pending}>{pending ? 'Signing in...' : 'Get Started'}</button>
          {error && <p className="notice" role="alert">{error}</p>}
        </form>
        <div className="or-divider"><span>or sign in with</span></div>
        <div className="social-row"><button type="button" disabled aria-label="Google sign in">G</button><button type="button" disabled aria-label="Facebook sign in">f</button><button type="button" disabled aria-label="Apple sign in">●</button></div>
      </section>
    </main>
  );
}
