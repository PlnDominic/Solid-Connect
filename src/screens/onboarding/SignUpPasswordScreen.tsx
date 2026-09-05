import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { colors, fonts, radii, spacing } from '../../theme';

const MIN_LENGTH = 8;

const RULES: { key: string; label: string; test: (v: string) => boolean }[] = [
  { key: 'length', label: `At least ${MIN_LENGTH} characters`, test: (v) => v.length >= MIN_LENGTH },
  { key: 'upper', label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'A number', test: (v) => /[0-9]/.test(v) },
  { key: 'symbol', label: 'A symbol (e.g. ! ? # @)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function SignUpPasswordScreen({
  totalSteps,
  activeIndex,
  onBack,
  onSubmit,
  loading,
  errorMessage,
}: {
  totalSteps: number;
  activeIndex: number;
  onBack: () => void;
  onSubmit: (password: string) => void;
  loading?: boolean;
  errorMessage?: string | null;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const ruleResults = RULES.map((rule) => ({ ...rule, met: rule.test(password) }));
  const meetsAllRules = ruleResults.every((r) => r.met);
  const matches = password.length > 0 && password === confirm;
  const isValid = meetsAllRules && matches;

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.back} disabled={!!loading}>
            <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
          </Pressable>
          <StepDots count={totalSteps} activeIndex={activeIndex} />
          <View style={styles.backSpacer} />
        </View>

        <View style={styles.body}>
          <View style={styles.textWrap}>
            <Text style={styles.title}>Create a password</Text>
            <Text style={styles.subtitle}>You'll use this to sign in next time.</Text>
          </View>

          <View style={styles.fields}>
            <View style={styles.inputRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onBlur={() => setTouched(true)}
                placeholder="Password"
                placeholderTextColor={colors.inkFainter}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="next"
                style={[styles.input, styles.inputWithIcon]}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={12}
                style={styles.eyeButton}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={19} strokeWidth={2} color={colors.inkFaint} />
                ) : (
                  <Eye size={19} strokeWidth={2} color={colors.inkFaint} />
                )}
              </Pressable>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                onBlur={() => setTouched(true)}
                placeholder="Confirm password"
                placeholderTextColor={colors.inkFainter}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => isValid && onSubmit(password)}
                style={[
                  styles.input,
                  styles.inputWithIcon,
                  touched && confirm.length > 0 && !matches && styles.inputError,
                ]}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={12}
                style={styles.eyeButton}
                accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? (
                  <EyeOff size={19} strokeWidth={2} color={colors.inkFaint} />
                ) : (
                  <Eye size={19} strokeWidth={2} color={colors.inkFaint} />
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.rules}>
            {ruleResults.map((rule) => (
              <View key={rule.key} style={styles.ruleRow}>
                <View style={[styles.ruleDot, rule.met && styles.ruleDotMet]}>
                  {rule.met ? <Check size={10} strokeWidth={3} color={colors.white} /> : null}
                </View>
                <Text style={[styles.ruleLabel, rule.met && styles.ruleLabelMet]}>{rule.label}</Text>
              </View>
            ))}
          </View>

          {touched && confirm.length > 0 && !matches ? (
            <Text style={styles.errorText}>Passwords don't match.</Text>
          ) : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.footer}>
          <Button title="Create account" onPress={() => onSubmit(password)} disabled={!isValid} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: 26, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 32 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.inkMuted, fontFamily: fonts.regular },

  fields: { gap: spacing.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: fonts.medium,
    color: colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: colors.hairlineStrong,
    paddingVertical: spacing.md,
  },
  inputWithIcon: { paddingRight: spacing.xxl },
  eyeButton: { position: 'absolute', right: 0, height: '100%', justifyContent: 'center', paddingHorizontal: 2 },
  inputError: { borderBottomColor: colors.danger },
  errorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger, marginTop: -spacing.md },

  rules: { gap: 10 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ruleDot: {
    width: 16,
    height: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleDotMet: { backgroundColor: colors.confirm, borderColor: colors.confirm },
  ruleLabel: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
  ruleLabelMet: { color: colors.ink, fontFamily: fonts.semibold },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
});
