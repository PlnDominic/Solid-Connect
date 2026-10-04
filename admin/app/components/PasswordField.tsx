'use client';

import { useState } from 'react';

function LockIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }
function EyeIcon({ off = false }: { off?: boolean }) { return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z" />{!off && <circle cx="12" cy="12" r="2.2" />}{off && <path d="m4 4 16 16" />}</svg>; }

/** New-password input for the auth cards (invite setup, reset): lock icon
 * plus a show/hide toggle, styled by `.reference-input` in login/polish.css
 * to match the sign-in form's password field. */
export function PasswordField({ label, value, onChange, minLength, autoFocus = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="reference-input">
      <LockIcon />
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={event => onChange(event.target.value)}
        autoComplete="new-password"
        placeholder={label}
        aria-label={label}
        minLength={minLength}
        required
        autoFocus={autoFocus}
      />
      <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>
        <EyeIcon off={!visible} />
      </button>
    </label>
  );
}
