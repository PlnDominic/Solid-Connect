'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase-browser';
import '../login/polish.css';

// Second sign-in step for administrators. If the account has no
// authenticator app yet, it is enrolled here first (QR code, then one code to
// confirm). Afterwards every sign-in asks for a six digit code.
// Enforced for every page by middleware.ts when ADMIN_REQUIRE_MFA=true.
export default function MfaPage() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getUser();
      if (!sessionData.user) {
        window.location.replace('/login');
        return;
      }
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        setReady(true);
        return;
      }
      const verified = factors?.totp?.[0];
      if (verified) {
        setFactorId(verified.id);
      } else {
        // Drop half-finished enrollments so a retry does not hit "name already used".
        for (const f of factors?.all ?? []) {
          if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Solid Connect admin' });
        if (enrollError || !data) {
          setError(enrollError?.message ?? 'Could not start two-step setup.');
        } else {
          setFactorId(data.id);
          setQr(data.totp.qr_code);
          setSecret(data.totp.secret);
        }
      }
      setReady(true);
    })();
  }, []);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setError('');
    setPending(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? 'Could not start the check.');
      setPending(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
    if (verifyError) {
      setError('That code is not right. Try the latest one in your app.');
      setPending(false);
      return;
    }
    window.location.assign('/verifications');
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign('/login');
  }

  return (
    <main className="login reference-login">
      <section className="reference-card" aria-labelledby="mfa-title">
        <img src="/logo.jpeg" alt="Solid Connect" className="reference-icon" width={96} height={96} />
        <h1 id="mfa-title">{qr ? 'Set up two-step sign-in.' : 'Enter your code.'}</h1>
        <p className="reference-subtitle">
          {qr ? (
            <>Scan this with an authenticator app (Google Authenticator, 1Password, Authy), then enter the six digit code.</>
          ) : (
            <>Open your authenticator app and enter the six digit code for Solid Connect.</>
          )}
        </p>
        {qr ? <img src={qr} alt="Authenticator QR code" width={180} height={180} style={{ display: 'block', margin: '0 auto 12px' }} /> : null}
        {secret ? (
          <p className="reference-subtitle" style={{ wordBreak: 'break-all' }}>
            Or type this key: <strong>{secret}</strong>
          </p>
        ) : null}
        {ready ? (
          <form onSubmit={verify}>
            <label className="reference-input">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 digit code"
                aria-label="Authenticator code"
                required
              />
            </label>
            <button className="reference-submit" disabled={pending || code.length !== 6 || !factorId}>
              {pending ? 'Checking…' : qr ? 'Turn on and continue' : 'Continue'}
            </button>
            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}
          </form>
        ) : (
          <p className="reference-subtitle">Loading…</p>
        )}
        <p className="login-foot">
          <button type="button" className="text-link" onClick={signOut}>
            Sign out
          </button>
        </p>
      </section>
    </main>
  );
}
