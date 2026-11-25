import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { Apple, Eye, EyeOff, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { GoogleMark } from '../../components/GoogleMark';
import { openLegalDoc } from '../../components/LegalDocLinks';
import { isAppleSignInAvailable } from '../../lib/auth';
import { legalDocUrl } from '../../lib/legal';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const logo = require('../../../assets/images/logo.jpeg');

export function SignInScreen({
  onBrowse,
  actionMessage,
  onSubmit,
  onGoToSignUp,
  onForgotPassword,
  onGoogle,
  onApple,
  loading,
  errorMessage,
}: {
  onBrowse?: () => void;
  actionMessage?: string;
  onSubmit: (email: string, password: string) => void;
  onGoToSignUp: () => void;
  onForgotPassword: (email?: string) => void;
  onGoogle: () => void;
  onApple: () => void;
  loading?: 'password' | 'google' | 'apple' | null;
  errorMessage?: string | null;
}) {
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const busy = !!loading;
  const canSubmit = !!email.trim() && !!password && !busy;
  const appleForeground = scheme === 'dark' ? colors.black : colors.white;
  const appleBackground = scheme === 'dark' ? colors.white : colors.black;

  useEffect(() => {
    let active = true;
    void isAppleSignInAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  function submit() {
    if (canSubmit) onSubmit(email.trim(), password);
  }

  return (
    <SafeAreaView style={styles.screen}>
      {onBrowse ? (
        <Pressable
          onPress={onBrowse}
          disabled={busy}
          style={[styles.iconButton, styles.closeButton]}
          accessibilityRole="button"
          accessibilityLabel="Back to browsing"
          accessibilityState={{ disabled: busy }}
        >
          <X size={21} color={colors.ink} />
        </Pressable>
      ) : null}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.brand}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandName}>Solid Connect</Text>
            </View>

            <View style={styles.heading}>
              <Text style={styles.title} accessibilityRole="header">Sign in</Text>
              {actionMessage ? <Text style={styles.hint}>{actionMessage}</Text> : null}
            </View>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email address</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  style={[styles.field, styles.input, focused === 'email' && styles.fieldFocused]}
                  accessibilityLabel="Email address"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.field, styles.passwordField, focused === 'password' && styles.fieldFocused]}>
                  <TextInput
                    ref={passwordRef}
                    value={password}
                    onChangeText={setPassword}
                    style={[styles.input, styles.passwordInput]}
                    accessibilityLabel="Password"
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    textContentType="password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                  />
                  <Pressable
                    onPress={() => setShowPassword((shown) => !shown)}
                    disabled={busy}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={19} color={colors.inkMuted} /> : <Eye size={19} color={colors.inkMuted} />}
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => onForgotPassword(email.trim() || undefined)}
                  disabled={busy}
                  style={[styles.textButton, styles.forgot]}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkText}>Forgot password?</Text>
                </Pressable>
              </View>

              {errorMessage ? (
                <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{errorMessage}</Text>
              ) : null}
              <Button
                title="Sign in"
                onPress={submit}
                disabled={!canSubmit}
                loading={loading === 'password'}
              />
            </View>

            <View style={styles.alternatives}>
              <View style={styles.divider} accessible={false}>
                <View style={styles.line} />
                <Text style={styles.hint}>or</Text>
                <View style={styles.line} />
              </View>
              <View style={styles.socialRow}>
                <Pressable
                  onPress={onGoogle}
                  disabled={busy}
                  style={({ pressed }) => [styles.social, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  accessibilityState={{ disabled: busy, busy: loading === 'google' }}
                >
                  {loading === 'google' ? <ActivityIndicator color={colors.ink} /> : (
                    <>
                      <GoogleMark />
                      <Text style={styles.socialText}>{appleAvailable ? 'Google' : 'Continue with Google'}</Text>
                    </>
                  )}
                </Pressable>
                {appleAvailable ? (
                  <Pressable
                    onPress={onApple}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.social,
                      { backgroundColor: appleBackground },
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Apple"
                    accessibilityState={{ disabled: busy, busy: loading === 'apple' }}
                  >
                    {loading === 'apple' ? <ActivityIndicator color={appleForeground} /> : (
                      <>
                        <Apple size={18} fill={appleForeground} color={appleForeground} />
                        <Text style={[styles.socialText, { color: appleForeground }]}>Apple</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Pressable onPress={onGoToSignUp} disabled={busy} style={styles.textButton} accessibilityRole="button">
              <Text style={styles.linkText}>Create an account</Text>
            </Pressable>

            {legalDocUrl('terms') || legalDocUrl('privacy') ? (
              <View style={styles.legal}>
                {legalDocUrl('terms') ? (
                  <Pressable onPress={() => void openLegalDoc('terms')} style={styles.textButton} accessibilityRole="link">
                    <Text style={styles.legalLink}>Terms</Text>
                  </Pressable>
                ) : null}
                {legalDocUrl('privacy') ? (
                  <Pressable onPress={() => void openLegalDoc('privacy')} style={styles.textButton} accessibilityRole="link">
                    <Text style={styles.legalLink}>Privacy Policy</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper },
    fill: { flex: 1 },
    scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
    content: { width: '100%', maxWidth: 416, marginVertical: 'auto', gap: spacing.lg },
    brand: { alignItems: 'center', gap: spacing.sm },
    logo: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.white },
    brandName: { color: colors.ink, fontFamily: fonts.bold, fontSize: fontSizes.lg, textAlign: 'center' },
    iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    closeButton: { alignSelf: 'flex-end', marginRight: spacing.xl, marginTop: spacing.xs },
    heading: { alignItems: 'center', gap: spacing.xs },
    title: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: fontSizes.title, letterSpacing: -0.7, textAlign: 'center' },
    hint: { color: colors.inkMuted, fontFamily: fonts.regular, fontSize: fontSizes.sm, textAlign: 'center' },
    form: { gap: spacing.md },
    fieldGroup: { gap: spacing.xs },
    label: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSizes.sm },
    field: {
      minHeight: 54, borderWidth: 1, borderColor: colors.hairlineStrong,
      borderRadius: radii.lg, backgroundColor: colors.card,
    },
    fieldFocused: { borderColor: colors.ink },
    input: { paddingHorizontal: spacing.md, fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.ink },
    passwordField: { flexDirection: 'row', alignItems: 'center' },
    passwordInput: { flex: 1, minHeight: 52 },
    textButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
    forgot: { alignSelf: 'flex-end' },
    linkText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSizes.sm, textDecorationLine: 'underline' },
    error: {
      color: colors.ink, backgroundColor: colors.dangerBg, padding: spacing.md,
      borderRadius: radii.md, fontFamily: fonts.medium, fontSize: fontSizes.sm,
    },
    alternatives: { gap: spacing.md },
    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
    socialRow: { flexDirection: 'row', gap: spacing.sm },
    social: {
      flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, paddingHorizontal: spacing.xs, borderWidth: 1, borderColor: colors.hairlineStrong,
      borderRadius: radii.lg, backgroundColor: colors.card,
    },
    socialText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: fontSizes.sm },
    pressed: { opacity: 0.75 },
    legal: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm },
    legalLink: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: fontSizes.xs },
  });
}
