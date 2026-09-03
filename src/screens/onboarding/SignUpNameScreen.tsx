import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../theme';
import { SignUpDetailScreen } from './SignUpDetailScreen';

export function SignUpNameScreen({
  totalSteps,
  activeIndex,
  value,
  onChangeValue,
  onBack,
  onNext,
  onGoToSignIn,
}: {
  totalSteps: number;
  activeIndex: number;
  value: string;
  onChangeValue: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onGoToSignIn: () => void;
}) {
  return (
    <SignUpDetailScreen
      totalSteps={totalSteps}
      activeIndex={activeIndex}
      title="What's your name?"
      subtitle="This is how providers and customers will see you on Solid Connect."
      value={value}
      onChangeValue={onChangeValue}
      onBack={onBack}
      onNext={onNext}
      placeholder="Full name"
      autoCapitalize="words"
      validate={(v) => v.trim().length >= 2}
      footerExtra={
        <Pressable onPress={onGoToSignIn} hitSlop={10}>
          <Text style={styles.link}>
            Already have an account? <Text style={styles.linkStrong}>Sign in</Text>
          </Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  link: { textAlign: 'center', fontSize: 14, fontFamily: fonts.medium, color: colors.inkMuted },
  linkStrong: { fontFamily: fonts.bold, color: colors.ink },
});
