import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { authenticateWithBiometrics, useBiometricLockPreference } from '../hooks/useBiometricLock';
import { Button } from './Button';
import { fonts, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Wraps the whole app. When the person has turned biometric lock on
 * (Account Security), this locks the screen behind a Face ID / Touch ID /
 * fingerprint prompt on cold launch and again every time the app returns
 * to the foreground - the standard behavior for a banking-style app lock.
 * Renders nothing itself (just `children`) when the preference is off or
 * hasn't loaded yet, so it never delays or blocks a normal launch.
 */
export function BiometricLockGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { enabled, loaded } = useBiometricLockPreference();
  const [locked, setLocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Once the preference finishes loading, a cold launch starts locked if
  // the person has this turned on.
  useEffect(() => {
    if (loaded && enabled) setLocked(true);
  }, [loaded, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current === 'active' && next.match(/inactive|background/)) {
        setLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (locked && enabled && !authenticating) {
      attemptUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, enabled]);

  async function attemptUnlock() {
    setAuthenticating(true);
    const ok = await authenticateWithBiometrics('Unlock Solid Connect');
    setAuthenticating(false);
    if (ok) setLocked(false);
  }

  const showOverlay = enabled && locked;

  return (
    <>
      {children}
      {showOverlay ? (
        <View style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: colors.paper }]}>
          <ShieldCheck size={40} strokeWidth={1.6} color={colors.ink} />
          <Text style={[styles.title, { color: colors.ink }]}>Solid Connect is locked</Text>
          <Text style={[styles.subtitle, { color: colors.inkMuted }]}>Verify it's you to continue.</Text>
          <Button title="Unlock" onPress={attemptUnlock} loading={authenticating} style={styles.button} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, zIndex: 999 },
  title: { fontSize: 17, fontFamily: fonts.bold },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, textAlign: 'center' },
  button: { marginTop: spacing.md, minWidth: 160 },
});
