import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { friendlyAuthError, sendPasswordResetEmail, verifyPasswordResetCode } from '../../lib/auth';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase's emailed code is 6 digits by default; projects can raise it.
const CODE_PATTERN = /^\d{6,10}$/;
// Supabase refuses a second reset email to the same address within 60s.
const RESEND_SECONDS = 60;

/**
 * "Forgot password?" from the login page, in two steps on one screen:
 * the account's email, then the code from the reset email. A verified code
 * signs the person in for this one purpose - onVerified hands off to the
 * new-password step. Tapping the link in the same email instead is caught
 * by AuthFlowScreen and lands on that same step.
 */
export function ForgotPasswordScreen({
  initialEmail = '',
  onBack,
  onVerified,
}: {
  initialEmail?: string;
  onBack: () => void;
  onVerified: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const trimmedEmail = email.trim();
  const emailValid = EMAIL_PATTERN.test(trimmedEmail);
  const codeValid = CODE_PATTERN.test(code);

  async function send() {
    if (!emailValid || loading) return;
    setLoading('send');
    setError(null);
    try {
      await sendPasswordResetEmail(trimmedEmail);
      setStep('code');
      setCode('');
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(friendlyAuthError(e, 'Could not send the reset email. Please try again.'));
    } finally {
      setLoading(null);
    }
  }

  async function verify() {
    if (!codeValid || loading) return;
    setLoading('verify');
    setError(null);
    try {
      await verifyPasswordResetCode(trimmedEmail, code);
      onVerified();
    } catch (e) {
      setError(friendlyAuthError(e, 'That code did not work. Check it and try again.'));
      setLoading(null);
    }
  }

  function back() {
    setError(null);
    if (step === 'code') setStep('email');
    else onBack();
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={back}
            hitSlop={12}
            style={styles.back}
            disabled={!!loading}
            accessibilityRole="button"
            accessibilityLabel={step === 'code' ? 'Change email' : 'Back to sign in'}
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
          </Pressable>
        </View>

        {step === 'email' ? (
          <View style={styles.body}>
            <View style={styles.textWrap}>
              <Text style={styles.title}>Reset your password</Text>
              <Text style={styles.subtitle}>
                Enter the email on your account and we'll send you a link and a code to set a new password.
              </Text>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.inkFainter}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!loading}
              returnKeyType="send"
              onSubmitEditing={send}
              style={styles.input}
              accessibilityLabel="Email address"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.textWrap}>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                If <Text style={styles.strong}>{trimmedEmail}</Text> has an account, we've sent it a reset email.
                Tap the link in it on this phone, or enter the code below.
              </Text>
            </View>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
              placeholder="Code"
              placeholderTextColor={colors.inkFainter}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={10}
              autoFocus
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={verify}
              style={[styles.input, styles.codeInput]}
              accessibilityLabel="Reset code"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable
              onPress={send}
              disabled={resendIn > 0 || !!loading}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ disabled: resendIn > 0 || !!loading }}
            >
              <Text style={[styles.resend, resendIn > 0 && styles.resendWaiting]}>
                {resendIn > 0 ? `Resend email in ${resendIn}s` : 'Resend email'}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          {step === 'email' ? (
            <Button title="Send reset email" onPress={send} disabled={!emailValid} loading={loading === 'send'} />
          ) : (
            <Button title="Continue" onPress={verify} disabled={!codeValid} loading={loading === 'verify'} />
          )}
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

    body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl },
    textWrap: { gap: 8 },
    title: { fontSize: fontSizes.title, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 34 },
    subtitle: { fontSize: fontSizes.md, lineHeight: 23, color: colors.inkMuted, fontFamily: fonts.regular },
    strong: { fontFamily: fonts.semibold, color: colors.ink },

    input: {
      fontSize: fontSizes.lg,
      fontFamily: fonts.medium,
      color: colors.ink,
      borderBottomWidth: 2,
      borderBottomColor: colors.hairlineStrong,
      paddingVertical: spacing.md,
    },
    codeInput: { letterSpacing: 6 },
    errorText: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.danger, marginTop: -spacing.md },
    resend: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.activeDeep },
    resendWaiting: { color: colors.inkFaint },

    footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
  });
}
