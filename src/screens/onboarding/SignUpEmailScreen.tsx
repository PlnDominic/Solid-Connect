import { useState } from 'react';
import { isEmailTaken } from '../../api/profile';
import { SignUpDetailScreen } from './SignUpDetailScreen';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpEmailScreen({
  totalSteps,
  activeIndex,
  value,
  onChangeValue,
  onBack,
  onNext,
}: {
  totalSteps: number;
  activeIndex: number;
  value: string;
  onChangeValue: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);

  async function handleNext() {
    setDupError(null);
    setChecking(true);
    try {
      const taken = await isEmailTaken(value.trim());
      if (taken) {
        setDupError('An account with that email already exists.');
        return;
      }
      onNext();
    } catch {
      // Real enforcement is Supabase auth's own email uniqueness, which
      // still applies at account creation - don't block on this pre-check.
      onNext();
    } finally {
      setChecking(false);
    }
  }

  return (
    <SignUpDetailScreen
      totalSteps={totalSteps}
      activeIndex={activeIndex}
      title="What's your email?"
      subtitle="For receipts and account updates."
      value={value}
      onChangeValue={(v) => {
        setDupError(null);
        onChangeValue(v);
      }}
      onBack={onBack}
      onNext={handleNext}
      placeholder="you@email.com"
      keyboardType="email-address"
      autoCapitalize="none"
      validate={(v) => EMAIL_RE.test(v.trim())}
      nextLabel="Continue"
      loading={checking}
      externalError={dupError}
    />
  );
}
