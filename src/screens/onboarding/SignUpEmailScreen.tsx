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
  return (
    <SignUpDetailScreen
      totalSteps={totalSteps}
      activeIndex={activeIndex}
      title="What's your email?"
      subtitle="For receipts and account updates."
      value={value}
      onChangeValue={onChangeValue}
      onBack={onBack}
      onNext={onNext}
      placeholder="you@email.com"
      keyboardType="email-address"
      autoCapitalize="none"
      validate={(v) => EMAIL_RE.test(v.trim())}
      nextLabel="Continue"
    />
  );
}
