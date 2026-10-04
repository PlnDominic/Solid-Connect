import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

/**
 * Solid Connect can't match people to nearby providers, estimate arrival
 * times or show live job tracking without the phone's location, so it is
 * required. Wraps the signed-in app: until location access is granted the
 * person only sees this screen. It re-checks when they return from the
 * system Settings, so there is no extra step after switching it on.
 */
export function LocationGate({ children }: { children: ReactNode }) {
  const { state, blocked, helpText, isWeb, attempted, request, openSettings } = useLocationPermission();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  if (state === 'granted') return <>{children}</>;

  if (state === 'checking') {
    return (
      <SafeAreaView style={[styles.fill, styles.center]}>
        <ActivityIndicator color={colors.ink} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <MapPin size={34} strokeWidth={2} color={colors.ink} />
        </View>
        <Text style={styles.title}>Location access is required</Text>
        <Text style={styles.copy}>
          Solid Connect uses your phone's location to find verified providers near you, estimate arrival times and show
          live job tracking. It is only shared with the other person while a job is active.
        </Text>
        {state === 'denied' || state === 'services_off' || attempted ? <Text style={styles.hint}>{helpText}</Text> : null}
      </View>
      <View style={styles.footer}>
        <Button
          title={blocked ? 'Reload' : 'Turn on location'}
          variant="navy"
          onPress={() => (blocked ? openSettings() : request())}
        />
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
    footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  });
}
