import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderEarningsThisMonth } from '../../api/jobs';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

export function PayoutDetailsScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: earnings = 0 } = useProviderEarningsThisMonth(profile?.id ?? null);

  return (
    <Screen>
      <ScreenHeader title="Payout details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available this month</Text>
          <Text style={styles.balanceValue}>GHS {earnings.toLocaleString()}</Text>
          <Text style={styles.balanceNote}>Released automatically when a customer confirms job completion.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowLabel}>Payout method</Text>
              <Text style={styles.rowDetail}>MTN Mobile Money · •••• 4821</Text>
            </View>
          </View>
          <View style={styles.rowBorder} />
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowLabel}>Payout schedule</Text>
              <Text style={styles.rowDetail}>Instant, after each confirmed job</Text>
            </View>
          </View>
        </View>

        <Text style={styles.note}>
          Payments are simulated in this demo - this screen shows real job/payment data from your account, but no
          money is actually transferred.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  balanceCard: { borderRadius: radii.xxl, backgroundColor: colors.navy, padding: spacing.xl, gap: 6 },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: fonts.medium },
  balanceValue: { color: colors.white, fontSize: 26, fontFamily: fonts.extrabold, fontVariant: ['tabular-nums'] },
  balanceNote: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: fonts.medium, marginTop: 4 },
  card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { padding: spacing.md, paddingHorizontal: spacing.lg },
  rowBorder: { height: 1, backgroundColor: colors.hairline },
  rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  rowDetail: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, marginTop: 2 },
  note: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, lineHeight: 18 },
});
