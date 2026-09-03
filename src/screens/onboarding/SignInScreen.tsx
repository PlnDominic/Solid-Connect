import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Apple, Mail, Phone } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { GoogleMark } from '../../components/GoogleMark';
import { colors, fonts, radii, spacing } from '../../theme';

type IdentifierMethod = 'email' | 'phone';

/**
 * The real login page - email-or-phone + password, plus Google and Apple.
 * Clean/plain background like the other credential screens, not the
 * full-bleed photo treatment: a form with real fields reads better without
 * something competing for attention behind it.
 */
export function SignInScreen({
  onSubmit,
  onGoToSignUp,
  onGoogle,
  onApple,
  loading,
  errorMessage,
}: {
  onSubmit: (identifier: string, password: string, method: IdentifierMethod) => void;
  onGoToSignUp: () => void;
  onGoogle: () => void;
  onApple: () => void;
  loading?: 'password' | 'google' | 'apple' | null;
  errorMessage?: string | null;
}) {
  const [method, setMethod] = useState<IdentifierMethod>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const busy = !!loading;

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !busy;

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Text style={styles.wordmark}>Solid Connect</Text>
          <View style={styles.textWrap}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.copy}>Sign in to pick up where you left off.</Text>
          </View>

          <View style={styles.methodRow}>
            <Pressable
              onPress={() => setMethod('email')}
              style={[styles.methodTab, method === 'email' && styles.methodTabActive]}
            >
              <Mail size={14} strokeWidth={2.2} color={method === 'email' ? colors.white : colors.inkMuted} />
              <Text style={[styles.methodLabel, method === 'email' && styles.methodLabelActive]}>Email</Text>
            </Pressable>
            <Pressable
              onPress={() => setMethod('phone')}
              style={[styles.methodTab, method === 'phone' && styles.methodTabActive]}
            >
              <Phone size={14} strokeWidth={2.2} color={method === 'phone' ? colors.white : colors.inkMuted} />
              <Text style={[styles.methodLabel, method === 'phone' && styles.methodLabelActive]}>Phone</Text>
            </Pressable>
          </View>

          <View style={styles.fields}>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={method === 'email' ? 'Email' : 'Phone number'}
              placeholderTextColor={colors.inkFainter}
              keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.inkFainter}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() => canSubmit && onSubmit(identifier.trim(), password, method)}
              style={styles.input}
            />
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Button
            title="Sign in"
            variant="navy"
            onPress={() => onSubmit(identifier.trim(), password, method)}
            disabled={!canSubmit}
            loading={loading === 'password'}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={onApple}
            disabled={busy}
            style={({ pressed }) => [styles.socialButton, pressed && !busy && styles.socialButtonPressed]}
          >
            {loading === 'apple' ? (
              <Text style={styles.socialLabel}>Signing in…</Text>
            ) : (
              <>
                <Apple size={18} strokeWidth={0} fill={colors.white} color={colors.white} />
                <Text style={styles.socialLabel}>Continue with Apple</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={onGoogle}
            disabled={busy}
            style={({ pressed }) => [styles.socialButton, pressed && !busy && styles.socialButtonPressed]}
          >
            {loading === 'google' ? (
              <Text style={styles.socialLabel}>Signing in…</Text>
            ) : (
              <>
                <GoogleMark size={18} />
                <Text style={styles.socialLabel}>Continue with Google</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={onGoToSignUp} disabled={busy} hitSlop={10}>
            <Text style={styles.link}>
              New here? <Text style={styles.linkStrong}>Create an account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.lg },
  wordmark: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: 0.2 },
  textWrap: { gap: 8 },
  title: { fontSize: 26, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 32 },
  copy: { fontSize: 15, lineHeight: 22, color: colors.inkMuted, fontFamily: fonts.regular },

  methodRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  methodTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  methodTabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  methodLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.inkMuted },
  methodLabelActive: { color: colors.white },

  fields: { gap: spacing.lg, marginTop: spacing.xs },
  input: {
    fontSize: 17,
    fontFamily: fonts.medium,
    color: colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: colors.hairlineStrong,
    paddingVertical: spacing.md,
  },
  errorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
  dividerLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },

  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  socialButtonPressed: { opacity: 0.88 },
  socialLabel: { fontSize: 15, fontFamily: fonts.bold, color: colors.white },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, alignItems: 'center' },
  link: { fontSize: 14, fontFamily: fonts.medium, color: colors.inkMuted },
  linkStrong: { fontFamily: fonts.bold, color: colors.ink },
});
