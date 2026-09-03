import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerJobsCount } from '../../api/jobs';
import { useSavedProviders, useToggleSavedProvider } from '../../api/saved';
import { useSwitchRole } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii } from '../../theme';

const SETTINGS_ROWS: { label: string; screen: string }[] = [
  { label: 'Payment methods', screen: 'PaymentMethods' },
  { label: 'Notifications', screen: 'Notifications' },
  { label: 'Help & support', screen: 'HelpSupport' },
];

export function ProfileScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: jobsCount = 0 } = useCustomerJobsCount(profile?.id ?? null);
  const { data: saved = [] } = useSavedProviders(profile?.id ?? null);
  const switchRole = useSwitchRole();
  const toggleSaved = useToggleSavedProvider();

  if (!profile) return <Screen />;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Avatar initials={profile.initials} size={56} />
          <View style={{ gap: 3 }}>
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.meta}>
              {profile.area} · {jobsCount} jobs posted
            </Text>
          </View>
        </View>
        <View style={styles.roleSwitch}>
          <View style={[styles.rolePill, styles.rolePillActive]}>
            <Text style={styles.rolePillTextActive}>Customer</Text>
          </View>
          <Pressable style={styles.rolePill} onPress={() => switchRole.mutate('provider')}>
            <Text style={styles.rolePillText}>Provider</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Saved providers</Text>
          {saved.map((p) => (
            <View key={p.id} style={styles.savedRow}>
              <Avatar initials={p.initials} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.savedName}>{p.full_name}</Text>
                <Text style={styles.savedMeta}>
                  {p.provider_category} · {p.provider_rating.toFixed(1)} ★ · {p.provider_distance_km} km
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => toggleSaved.mutate({ customerId: profile.id, providerId: p.id, saved: true })}
              >
                <Text style={{ fontSize: 16, color: colors.orange }}>♥</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

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
  meta: { fontSize: 13, color: colors.textFaint },
  roleSwitch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.lg, backgroundColor: colors.hairlineSoft },
  rolePill: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  rolePillActive: { backgroundColor: colors.white },
  rolePillText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textFaint },
  rolePillTextActive: { fontSize: 14, fontFamily: fonts.bold, color: colors.textHeading },
  body: { padding: 16, gap: 20 },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  savedRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  savedName: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  savedMeta: { fontSize: 12, color: colors.textFaint },
  divider: { height: 1, backgroundColor: colors.hairlineSoft },
  settingsCard: { borderRadius: radii.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  settingsLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textHeading },
  chevron: { fontSize: 16, color: colors.textFaint },
});
