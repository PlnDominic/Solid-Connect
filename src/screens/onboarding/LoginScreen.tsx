import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { colors, fonts, radii, shadow, spacing } from '../../theme';

const logo = require('../../../assets/images/logo.jpeg');

export function LoginScreen({
  onSelectRole,
  loading,
}: {
  onSelectRole: (role: 'customer' | 'provider') => void;
  loading?: 'customer' | 'provider' | null;
}) {
  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.center}>
        <View style={styles.logoCard}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.tagline}>
          Find verified plumbers, electricians and artisans near you in Accra, or get hired for jobs nearby.
        </Text>
      </View>
      <View style={styles.footer}>
        <Button
          title="Continue as customer"
          onPress={() => onSelectRole('customer')}
          loading={loading === 'customer'}
          disabled={!!loading}
        />
        <Button
          title="Continue as provider"
          variant="outline"
          onPress={() => onSelectRole('provider')}
          loading={loading === 'provider'}
          disabled={!!loading}
        />
        <Text style={styles.demo}>Demo mode — no phone verification needed</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.white, justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  logoCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xxxl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    ...shadow.sheet,
  },
  logo: { width: 180, height: 100 },
  tagline: { fontSize: 15, lineHeight: 23, color: 'rgba(17,17,19,0.65)', textAlign: 'center', maxWidth: 280 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: 40, gap: 12 },
  demo: { fontSize: 12, color: 'rgba(17,17,19,0.4)', textAlign: 'center', marginTop: 4, fontFamily: fonts.medium },
});
