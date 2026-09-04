'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '../../lib/supabase-browser';

export default function LoginPage() {
  const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  async function signIn(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(''); const form = new FormData(event.currentTarget); const { error: authError } = await createClient().auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) }); if (authError) { setError(authError.message); setPending(false); return; } window.location.assign('/verifications'); }
  return <main className="login"><section className="login-card"><p className="eyebrow">Solid Connect</p><h1>Operations desk</h1><p className="intro">Sign in with your provisioned administrator account.</p><form onSubmit={signIn}><input name="email" type="email" autoComplete="email" placeholder="Email address" required /><input name="password" type="password" autoComplete="current-password" placeholder="Password" required /><button className="button" disabled={pending}>{pending ? 'Signing in?' : 'Sign in'}</button>{error && <p className="notice">{error}</p>}</form></section></main>;
}
