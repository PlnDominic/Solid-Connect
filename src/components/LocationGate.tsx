import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { setLocationSkipped, wasLocationSkipped } from '../lib/locationChoice';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

/**
 * Asks for the phone's location once, and explains why. Location makes the
 * app better (nearby providers, arrival times, live job tracking) but is not
 * required: everything that reads the position falls back to the neighbourhood
 * on the person's profile, and live job tracking asks again at the moment it
 * is needed. So "Continue without location" is always available, and the
 * choice is remembered rather than showing this screen on every launch.
 */
export function LocationGate({ children }: { children: ReactNode }) {
  const { state, blocked, helpText, attempted, request, openSettings } = useLocationPermission();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [skipped, setSkipped] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    wasLocationSkipped().then((v) => {
      if (!cancelled) setSkipped(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'granted' || skipped) return <>{children}</>;

  if (state === 'checking' || skipped === null) {
    return (
      <SafeAreaView style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.ink} />
      </SafeAreaView>
    );
  }

  async function continueWithout() {
    await setLocationSkipped(true);
    setSkipped(true);
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MapPin size={34} strokeWidth={2} color={colors.ink} />
        </View>
        <Text style={styles.title}>Find providers near you</Text>
        <Text style={styles.copy}>
          Turn on location to see providers closest to you, estimate arrival times and follow a job live. It is
          only shared with the other person while a job is active. Prefer not to? You can still use Solid Connect
          with the neighbourhood from your profile.
        </Text>
        {state === 'denied' || state === 'services_off' || attempted ? <Text style={styles.hint}>{helpText}</Text> : null}
      </View>
      <View style={styles.footer}>
        <Button
          title={blocked ? 'Open settings' : 'Turn on location'}
          variant="active"
          onPress={() => (blocked ? openSettings() : request())}
        />
        <Button title="Continue without location" variant="ghost" onPress={continueWithout} />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.paper },
    center: { alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
    iconWrap: {
      width: 84,
      height: 84,
      borderRadius: radii.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    title: { fontSize: fontSizes.xxl, fontFamily: fonts.extrabold, color: colors.ink, textAlign: 'center', letterSpacing: -0.4 },
    copy: { fontSize: fontSizes.md, lineHeight: 23, fontFamily: fonts.regular, color: colors.inkMuted, textAlign: 'center' },
    hint: { fontSize: fontSizes.sm, lineHeight: 21, fontFamily: fonts.medium, color: colors.danger, textAlign: 'center' },
    footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  });
}
