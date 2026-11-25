import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const MIN_LENGTH = 8;

export function SignUpPasswordScreen({
  totalSteps,
  activeIndex,
  onBack,
  onSubmit,
  loading,
  errorMessage,
  title = 'Create a password',
  subtitle = "You'll use this to sign in next time.",
  submitLabel = 'Create account',
}: {
  totalSteps: number;
  activeIndex: number;
  onBack: () => void;
  onSubmit: (password: string) => void;
  loading?: boolean;
  errorMessage?: string | null;
  /** Overridden when this screen sets a new password after a reset. */
  title?: string;
  subtitle?: string;
  submitLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isValid = password.length >= MIN_LENGTH;

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.back}
            disabled={!!loading}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
          </Pressable>
          {totalSteps > 0 ? <StepDots count={totalSteps} activeIndex={activeIndex} /> : null}
          <View style={styles.backSpacer} />
        </View>

        <View style={styles.body}>
          <View style={styles.textWrap}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.fields}>
            <View style={styles.inputRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!loading}
                placeholder="Password"
                placeholderTextColor={colors.inkFainter}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => { if (isValid && !loading) onSubmit(password); }}
                style={[styles.input, styles.inputWithIcon]}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={12}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={19} strokeWidth={2} color={colors.inkFaint} />
                ) : (
                  <Eye size={19} strokeWidth={2} color={colors.inkFaint} />
                )}
              </Pressable>
            </View>

          </View>
          <Text style={styles.passwordHint}>Use at least {MIN_LENGTH} characters. A few words together work well.</Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.footer}>
          <Button title={submitLabel} onPress={() => onSubmit(password)} disabled={!isValid} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    back: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    backSpacer: { width: 32 },

    body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl },
    textWrap: { gap: 8 },
    title: { fontSize: fontSizes.title, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 34 },
    subtitle: { fontSize: fontSizes.md, lineHeight: 23, color: colors.inkMuted, fontFamily: fonts.regular },

    fields: { gap: spacing.lg },
    inputRow: { flexDirection: 'row', alignItems: 'center' },
    input: {
      flex: 1,
      fontSize: fontSizes.lg,
      fontFamily: fonts.medium,
      color: colors.ink,
      borderBottomWidth: 2,
      borderBottomColor: colors.hairlineStrong,
      paddingVertical: spacing.md,
    },
    inputWithIcon: { paddingRight: spacing.xxl },
    eyeButton: { position: 'absolute', right: 0, height: '100%', justifyContent: 'center', paddingHorizontal: 2 },
    errorText: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.danger, marginTop: -spacing.md },

    passwordHint: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkMuted },

    footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  });
}
