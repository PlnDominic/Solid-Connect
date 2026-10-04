import { useState } from 'react';
import { isPhoneTaken } from '../../api/profile';
import { isPlausiblePhone } from '../../lib/signUpSteps';
import { SignUpDetailScreen } from './SignUpDetailScreen';

export function SignUpPhoneScreen({
  totalSteps,
  activeIndex,
  value,
  onChangeValue,
  excludeUserId,
  onBack,
  onNext,
}: {
  totalSteps: number;
  activeIndex: number;
  value: string;
  onChangeValue: (v: string) => void;
  /** The signed-in user's own id, so their own number isn't "taken". */
  excludeUserId?: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);

  async function handleNext() {
    setDupError(null);
    setChecking(true);
    try {
      const taken = await isPhoneTaken(value.trim(), excludeUserId ?? undefined);
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
