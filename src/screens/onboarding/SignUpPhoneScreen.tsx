import { useState } from 'react';
import { isPhoneTaken } from '../../api/profile';
import { SignUpDetailScreen } from './SignUpDetailScreen';

// Loose but real check: digits/spaces/+/- only, at least 9 digits - enough
// to catch typos without pretending this is OTP-grade validation.
function isPlausiblePhone(v: string): boolean {
  const digits = v.replace(/[^\d]/g, '');
  return /^[\d+\-\s]+$/.test(v.trim()) && digits.length >= 9;
}

export function SignUpPhoneScreen({
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
      const taken = await isPhoneTaken(value.trim());
      if (taken) {
        setDupError('That phone number is already registered.');
        return;
      }
      onNext();
    } catch {
      // Not the real guard (the DB unique constraint is) - don't block
      // sign-up on a failed pre-check, e.g. while offline.
      onNext();
    } finally {
      setChecking(false);
    }
  }

  return (
    <SignUpDetailScreen
      totalSteps={totalSteps}
      activeIndex={activeIndex}
      title="What's your phone number?"
      subtitle="Providers and customers use this to reach you about a job. No OTP for now - that's coming before launch."
      value={value}
      onChangeValue={(v) => {
        setDupError(null);
        onChangeValue(v);
      }}
      onBack={onBack}
      onNext={handleNext}
      placeholder="024 123 4567"
      keyboardType="phone-pad"
      autoCapitalize="none"
      validate={isPlausiblePhone}
      loading={checking}
      externalError={dupError}
    />
  );
}
