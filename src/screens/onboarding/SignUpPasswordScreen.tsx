import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { colors, fonts, radii, spacing } from '../../theme';

const MIN_LENGTH = 8;

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

  const longEnough = password.length >= MIN_LENGTH;
  const matches = password.length > 0 && password === confirm;
  const isValid = longEnough && matches;

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
            <Text style={styles.subtitle}>At least {MIN_LENGTH} characters. You'll use this to sign in next time.</Text>
          </View>

          <View style={styles.fields}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onBlur={() => setTouched(true)}
              placeholder="Password"
              placeholderTextColor={colors.inkFainter}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
              style={styles.input}
            />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => setTouched(true)}
              placeholder="Confirm password"
              placeholderTextColor={colors.inkFainter}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => isValid && onSubmit(password)}
              style={[styles.input, touched && confirm.length > 0 && !matches && styles.inputError]}
            />
          </View>

          {touched && confirm.length > 0 && !matches ? (
            <Text style={styles.errorText}>Passwords don't match.</Text>
          ) : touched && !longEnough ? (
            <Text style={styles.errorText}>Password needs to be at least {MIN_LENGTH} characters.</Text>
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
  input: {
    fontSize: 18,
    fontFamily: fonts.medium,
    color: colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: colors.hairlineStrong,
    paddingVertical: spacing.md,
  },
  inputError: { borderBottomColor: colors.danger },
  errorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger, marginTop: -spacing.md },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
});
