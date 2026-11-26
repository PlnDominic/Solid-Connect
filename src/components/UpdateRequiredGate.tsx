import type { ReactNode } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isOlderVersion } from '../lib/appVersion';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { fonts, fontSizes, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

const PLAY_STORE_URL = 'market://details?id=com.solidconnect.app';

/**
 * Replaces the app with an "update" screen when this version is below the
 * minimum set in the database (migration 0093). Checked on launch and each
 * time the app comes back. The app stays usable while the check is running,
 * offline, or if it fails.
 */
export function UpdateRequiredGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { data: minimum } = useQuery({
    queryKey: ['minAppVersion'],
    enabled: isSupabaseConfigured && Platform.OS !== 'web',
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('min_app_version');
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });

  if (!isOlderVersion(Constants.expoConfig?.version, minimum)) return <>{children}</>;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.paper }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Download size={40} strokeWidth={1.6} color={colors.ink} />
        <Text style={[styles.title, { color: colors.ink }]}>Update Solid Connect</Text>
        <Text style={[styles.copy, { color: colors.inkMuted }]}>
          This version no longer works properly. Your account and jobs are safe.{' '}
          {Platform.OS === 'ios'
            ? 'Install the latest version from the App Store, or from TestFlight if you are a tester.'
            : 'Install the latest version from Google Play.'}
        </Text>
      </View>
      {Platform.OS === 'android' ? (
        <View style={styles.footer}>
          <Button title="Open Google Play" variant="active" onPress={() => void Linking.openURL(PLAY_STORE_URL).catch(() => {})} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  title: { fontSize: fontSizes.xxl, fontFamily: fonts.extrabold, textAlign: 'center' },
  copy: { fontSize: fontSizes.md, lineHeight: 23, fontFamily: fonts.regular, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
});
