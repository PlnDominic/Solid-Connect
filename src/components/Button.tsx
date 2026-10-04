import { ActivityIndicator, Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { fonts, fontSizes, radii } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

type Variant = 'primary' | 'navy' | 'active' | 'outline' | 'ghost';

/**
 * Filled CTAs (`primary` and `active`) are brand orange with a white label
 * in both light and dark themes - the same "active" accent as a picked
 * filter, category or chip. `primary` is kept as an alias so existing call
 * sites need no change. `navy` is the brand-navy variant used on
 * onboarding/login (matches the Home hero card). Secondary actions use
 * `outline` or `ghost` and stay neutral.
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const isPrimary = variant === 'primary';
  const isNavy = variant === 'navy';
  const isActive = variant === 'active';
  const isOutline = variant === 'outline';
  const isFilled = isPrimary || isNavy || isActive;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        (isPrimary || isActive) && styles.active,
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
        <Text
          style={[styles.label, { color: isFilled ? colors.white : colors.ink }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    base: {
      height: 54,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    navy: {
      backgroundColor: colors.navy,
      shadowColor: colors.black,
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    active: {
      backgroundColor: colors.active,
      shadowColor: colors.activeDeep,
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    outline: { borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.card },
    ghost: { backgroundColor: 'transparent' },
    disabled: { opacity: 0.55 },
    pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
    label: { fontFamily: fonts.bold, fontSize: fontSizes.lg, letterSpacing: -0.1 },
  });
}
