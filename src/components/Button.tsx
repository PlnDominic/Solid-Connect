import { ActivityIndicator, Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, fonts, radii } from '../theme';

type Variant = 'primary' | 'navy' | 'outline' | 'ghost';

/**
 * Primary CTAs stay ink. `navy` is the brand-navy variant used on
 * onboarding/login (matches the Home hero card) - it's a branding choice,
 * not the confirm-green accent, which stays reserved elsewhere for actions
 * that themselves complete a verification/payment moment.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isPrimary = variant === 'primary';
  const isNavy = variant === 'navy';
  const isOutline = variant === 'outline';
  const isFilled = isPrimary || isNavy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isNavy && styles.navy,
        isOutline && styles.outline,
        variant === 'ghost' && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isFilled ? colors.white : colors.ink} />
      ) : (
        <Text style={[styles.label, { color: isFilled ? colors.white : colors.ink }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: colors.ink,
    shadowColor: colors.black,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  navy: {
    backgroundColor: colors.navy,
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  outline: { borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.card },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  label: { fontFamily: fonts.bold, fontSize: 15.5, letterSpacing: -0.1 },
});
