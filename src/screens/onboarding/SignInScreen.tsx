import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Apple, ArrowRight, Eye, EyeOff, Lock, Mail, Phone } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { GoogleMark } from '../../components/GoogleMark';
import { isAppleSignInAvailable } from '../../lib/auth';
import { fonts, fontSizes, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

type IdentifierMethod = 'email' | 'phone';

const logo = require('../../../assets/images/logo.jpeg');

// Brand constants for the header. The header is always the brand orange,
// in light and dark mode alike, so these don't come from the theme.
const ORANGE = '#F27511';
const ORANGE_DEEP = '#C85A08';
const ORANGE_SOFT = '#FFE1C4';

/**
 * The login page: a deep-navy brand header (mark, promise, what makes the
 * marketplace trustworthy) with the form on an elevated card that rises
 * over it. Email-or-phone + password, plus Apple and Google.
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
  const { colors, isDark } = useThemeSafe();
  const styles = makeStyles(colors, isDark);
  const [method, setMethod] = useState<IdentifierMethod>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'id' | 'pw' | null>(null);
  const [segWidth, setSegWidth] = useState(0);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const busy = !!loading;
  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !busy;

  useEffect(() => {
    let alive = true;
    void isAppleSignInAvailable().then((available) => {
      if (alive) setAppleAvailable(available);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Entrance: header content fades down, the card rises.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  // The segmented control's sliding thumb.
  const thumb = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(thumb, { toValue: method === 'email' ? 0 : 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [method, thumb]);

  function submit() {
    if (canSubmit) onSubmit(identifier.trim(), password, method);
  }

  const headerStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
  };
  const cardStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }],
  };
  const half = Math.max(0, (segWidth - 8) / 2);

  return (
    <View style={styles.root}>
      <HeaderBackdrop />

      <SafeAreaView style={styles.fill} edges={['top']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Animated.View style={[styles.header, headerStyle]}>
              <View style={styles.brandRow}>
                <View style={styles.logoTile}>
                  <Image source={logo} style={styles.logo} resizeMode="contain" />
                </View>
                <Text style={styles.brandName}>Solid Connect</Text>
              </View>

              <Text style={styles.headline}>
                Trusted hands,{'\n'}
                <Text style={styles.headlineAccent}>on demand.</Text>
              </Text>
              <Text style={styles.subhead}>Sign in to book verified pros across Accra, or to manage your jobs.</Text>

            </Animated.View>

            <Animated.View style={[styles.card, cardStyle]}>
              <Text style={styles.cardTitle}>Welcome back</Text>

              <View
                style={styles.segment}
                onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
                accessibilityRole="tablist"
              >
                {segWidth > 0 ? (
                  <Animated.View
                    style={[
                      styles.segmentThumb,
                      { width: half, transform: [{ translateX: thumb.interpolate({ inputRange: [0, 1], outputRange: [0, half] }) }] },
                    ]}
                  />
                ) : null}
                {(['email', 'phone'] as const).map((m) => {
                  const on = method === m;
                  const Icon = m === 'email' ? Mail : Phone;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => {
                        setMethod(m);
                        setIdentifier('');
                      }}
                      disabled={busy}
                      style={styles.segmentItem}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                    >
                      <Icon size={15} strokeWidth={2.2} color={on ? colors.ink : colors.inkFaint} />
                      <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>{m === 'email' ? 'Email' : 'Phone'}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.fields}>
                <View>
                  <Text style={styles.fieldLabel}>{method === 'email' ? 'Email address' : 'Phone number'}</Text>
                  <View style={[styles.field, focused === 'id' && styles.fieldFocused]}>
                    {method === 'email' ? (
                      <Mail size={18} strokeWidth={2} color={focused === 'id' ? colors.ink : colors.inkFaint} />
                    ) : (
                      <Phone size={18} strokeWidth={2} color={focused === 'id' ? colors.ink : colors.inkFaint} />
                    )}
                    <TextInput
                      value={identifier}
                      onChangeText={setIdentifier}
                      placeholder={method === 'email' ? 'you@example.com' : '+233 24 123 4567'}
                      placeholderTextColor={colors.inkFainter}
                      keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
                      textContentType={method === 'email' ? 'emailAddress' : 'telephoneNumber'}
                      autoComplete={method === 'email' ? 'email' : 'tel'}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      onFocus={() => setFocused('id')}
                      onBlur={() => setFocused(null)}
                      style={styles.input}
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={[styles.field, focused === 'pw' && styles.fieldFocused]}>
                    <Lock size={19} strokeWidth={2} color={focused === 'pw' ? colors.ink : colors.inkFaint} />
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Your password"
                      placeholderTextColor={colors.inkFainter}
                      secureTextEntry={!showPassword}
                      textContentType="password"
                      autoComplete="password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                      returnKeyType="go"
                      onSubmitEditing={submit}
                      onFocus={() => setFocused('pw')}
                      onBlur={() => setFocused(null)}
                      style={styles.input}
                    />
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      disabled={busy}
                      hitSlop={12}
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
              </View>

              {errorMessage ? (
                <View style={styles.errorBox} accessibilityLiveRegion="polite">
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                style={({ pressed }) => [styles.primary, !canSubmit && styles.primaryDisabled, pressed && canSubmit && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit, busy: loading === 'password' }}
              >
                {loading === 'password' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryLabel}>Sign in</Text>
                    <View style={styles.primaryArrow}>
                      <ArrowRight size={16} strokeWidth={2.6} color={ORANGE} />
                    </View>
                  </>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                {appleAvailable ? (
                  <Pressable
                    onPress={onApple}
                    disabled={busy}
                    style={({ pressed }) => [styles.social, styles.socialApple, pressed && !busy && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Apple"
                  >
                    {loading === 'apple' ? (
                      <ActivityIndicator color={isDark ? colors.black : '#FFFFFF'} />
                    ) : (
                      <>
                        <Apple size={18} strokeWidth={0} fill={isDark ? colors.black : '#FFFFFF'} color={isDark ? colors.black : '#FFFFFF'} />
                        <Text style={[styles.socialLabel, styles.socialLabelApple]}>Apple</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onGoogle}
                  disabled={busy}
                  style={({ pressed }) => [styles.social, styles.socialGoogle, pressed && !busy && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                >
                  {loading === 'google' ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <>
                      <GoogleMark size={18} />
                      <Text style={styles.socialLabel}>Google</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Pressable onPress={onGoToSignUp} disabled={busy} hitSlop={10} style={styles.signupRow} accessibilityRole="link">
                <Text style={styles.link}>
                  New to Solid Connect? <Text style={styles.linkStrong}>Create an account</Text>
                </Text>
              </Pressable>
            </Animated.View>

            <Text style={styles.legal}>By continuing you agree to our Terms and Privacy Policy.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** The orange header ground: a warm gradient with soft, off-center rings
 * and a light glow. Drawn, not an image, so it stays crisp at any size. */
function HeaderBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="62%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 520">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={ORANGE} />
            <Stop offset="1" stopColor={ORANGE_DEEP} />
          </LinearGradient>
          <LinearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="400" height="520" fill="url(#bg)" />
        <Circle cx="360" cy="40" r="150" fill="url(#glow)" opacity="0.35" />
        <Circle cx="360" cy="40" r="120" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="1" fill="none" />
        <Circle cx="360" cy="40" r="190" stroke="#FFFFFF" strokeOpacity="0.11" strokeWidth="1" fill="none" />
        <Circle cx="360" cy="40" r="260" stroke="#FFFFFF" strokeOpacity="0.09" strokeWidth="1" fill="none" />
        <Circle cx="360" cy="40" r="330" stroke="#FFFFFF" strokeOpacity="0.07" strokeWidth="1" fill="none" />
      </Svg>
    </View>
  );
}

function useThemeSafe() {
  const { colors, scheme } = useTheme();
  return { colors, isDark: scheme === 'dark' };
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.paper },
    fill: { flex: 1 },
    scroll: { flexGrow: 1, paddingBottom: spacing.xl },

    header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl + spacing.lg, gap: spacing.md },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg },
    logoTile: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logo: { width: 34, height: 34 },
    brandName: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: '#FFFFFF', letterSpacing: 0.2 },
    headline: { fontSize: fontSizes.display, lineHeight: 40, fontFamily: fonts.extrabold, color: '#FFFFFF', letterSpacing: -0.8 },
    headlineAccent: { color: ORANGE_SOFT },
    subhead: { fontSize: fontSizes.md, lineHeight: 23, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.86)', maxWidth: 320 },

    card: {
      marginHorizontal: spacing.lg,
      marginTop: -spacing.xxl,
      padding: spacing.xl,
      paddingTop: spacing.xxl,
      gap: spacing.lg,
      borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.hairline,
      shadowColor: '#5A2A05',
      shadowOpacity: isDark ? 0 : 0.14,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    },
    cardTitle: { fontSize: fontSizes.xxl, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4 },

    segment: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 14,
      backgroundColor: colors.paperDim,
    },
    segmentThumb: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 11,
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    segmentItem: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    segmentLabel: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkFaint },
    segmentLabelOn: { color: colors.ink },

    fields: { gap: spacing.md },
    fieldLabel: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, color: colors.inkMuted, marginBottom: 6, letterSpacing: 0.1 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 54,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.hairline,
      backgroundColor: colors.paperDim,
    },
    fieldFocused: { borderColor: ORANGE, backgroundColor: colors.card },
    // outlineWidth: 0 removes the browser's own focus ring on the web preview;
    // the field's border already shows focus.
    input: { flex: 1, height: '100%', fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.ink, outlineWidth: 0 } as never,

    errorBox: { borderRadius: 12, padding: spacing.md, backgroundColor: colors.dangerBg },
    errorText: { fontSize: fontSizes.sm, lineHeight: 19, fontFamily: fonts.medium, color: colors.danger },

    primary: {
      height: 56,
      borderRadius: 16,
      backgroundColor: ORANGE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      shadowColor: ORANGE_DEEP,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    primaryDisabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
    primaryLabel: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: '#FFFFFF', letterSpacing: 0.2 },
    primaryArrow: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },

    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
    dividerLabel: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },

    socialRow: { flexDirection: 'row', gap: spacing.md },
    social: {
      flex: 1,
      height: 52,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    socialApple: { backgroundColor: isDark ? '#FFFFFF' : colors.black },
    socialGoogle: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.hairline },
    socialLabel: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    socialLabelApple: { color: isDark ? colors.black : '#FFFFFF' },

    signupRow: { alignItems: 'center', paddingTop: spacing.xs },
    link: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkMuted },
    linkStrong: { fontFamily: fonts.bold, color: isDark ? ORANGE : ORANGE_DEEP },

    legal: {
      textAlign: 'center',
      fontSize: fontSizes.xs,
      lineHeight: 17,
      fontFamily: fonts.regular,
      color: colors.inkFaint,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.xxl,
    },
  });
}
