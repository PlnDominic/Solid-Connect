import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderEarningsThisMonth } from '../../api/jobs';
import { useSwitchRole } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii } from '../../theme';

const SETTINGS_ROWS: { label: string; screen: string }[] = [
  { label: 'Payout details', screen: 'PayoutDetails' },
  { label: 'Service areas', screen: 'ServiceAreas' },
  { label: 'Help & support', screen: 'HelpSupport' },
];

export function ProfileScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: earnings = 0 } = useProviderEarningsThisMonth(profile?.id ?? null);
  const switchRole = useSwitchRole();

  if (!profile) return <Screen />;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Avatar initials={profile.initials} size={56} />
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name}>{profile.full_name}</Text>
              {profile.provider_verified ? (
                <View style={styles.verifiedDot}>
                  <Text style={{ color: colors.white, fontSize: 10, fontFamily: fonts.extrabold }}>✓</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.meta}>
              {profile.provider_category} · {profile.provider_rating.toFixed(1)} ★ · {profile.provider_jobs_count} jobs
            </Text>
          </View>
        </View>
        <View style={styles.roleSwitch}>
          <Pressable style={styles.rolePill} onPress={() => switchRole.mutate('customer')}>
            <Text style={styles.rolePillText}>Customer</Text>
          </Pressable>
          <View style={[styles.rolePill, styles.rolePillActive]}>
            <Text style={styles.rolePillTextActive}>Provider</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>This month</Text>
            <Text style={styles.statValue}>GHS {earnings.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Rating</Text>
            <Text style={styles.statValue}>{profile.provider_rating.toFixed(1)} ★</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {profile.provider_verified ? <Badge label="✓ Identity verified" bg={colors.tile} fg={colors.black} /> : null}
          {profile.provider_certified ? <Badge label="★ Solid Connect certified" bg={colors.ink} fg={colors.white} /> : null}
        </View>

        <View style={styles.settingsCard}>
          {SETTINGS_ROWS.map((row, i) => (
            <Pressable
              key={row.label}
              onPress={() => navigation.navigate(row.screen)}
              style={[styles.settingsRow, i < SETTINGS_ROWS.length - 1 && styles.settingsRowBorder]}
            >
              <Text style={styles.settingsLabel}>{row.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.hairline, gap: 16, backgroundColor: colors.card },
  identity: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  name: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.ink },
  verifiedDot: { width: 16, height: 16, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  meta: { fontSize: 13, color: colors.textFaint },
  roleSwitch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.lg, backgroundColor: colors.hairlineSoft },
  rolePill: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  rolePillActive: { backgroundColor: colors.white },
  rolePillText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textFaint },
  rolePillTextActive: { fontSize: 14, fontFamily: fonts.bold, color: colors.textHeading },
  body: { padding: 16, gap: 16 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, borderRadius: radii.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, padding: 16, gap: 4 },
  statLabel: { fontSize: 12, color: colors.textFaint },
  statValue: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
  settingsCard: { borderRadius: radii.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  settingsLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textHeading },
  chevron: { fontSize: 16, color: colors.textFaint },
});
