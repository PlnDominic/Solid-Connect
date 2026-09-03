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
  return (
    <SignUpDetailScreen
      totalSteps={totalSteps}
      activeIndex={activeIndex}
      title="What's your phone number?"
      subtitle="Providers and customers use this to reach you about a job. No OTP for now - that's coming before launch."
      value={value}
      onChangeValue={onChangeValue}
      onBack={onBack}
      onNext={onNext}
      placeholder="024 123 4567"
      keyboardType="phone-pad"
      autoCapitalize="none"
      validate={isPlausiblePhone}
    />
  );
}
