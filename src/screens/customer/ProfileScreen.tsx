import { ChevronRight, Heart, Star } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerJobsCount } from '../../api/jobs';
import { useSavedProviders, useToggleSavedProvider } from '../../api/saved';
import { useSwitchRole } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { signOut } from '../../lib/auth';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

const SETTINGS_ROWS: { label: string; screen: string }[] = [
  { label: 'Edit profile', screen: 'EditProfile' },
  { label: 'Payment methods', screen: 'PaymentMethods' },
  { label: 'Notifications', screen: 'Notifications' },
  { label: 'Account & security', screen: 'AccountSecurity' },
  { label: 'Privacy & data', screen: 'PrivacyData' },
  { label: 'Legal', screen: 'Legal' },
  { label: 'Help & support', screen: 'HelpSupport' },
];

export function ProfileScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: jobsCount = 0 } = useCustomerJobsCount(profile?.id ?? null);
  const { data: saved = [] } = useSavedProviders(profile?.id ?? null);
  const switchRole = useSwitchRole();
  const toggleSaved = useToggleSavedProvider();

  // Ends the real Supabase session and returns to the login page. Walks up
  // to the root stack navigator to reset onto "Auth".
  async function handleSignOut() {
    await signOut();
    useSessionStore.getState().setProfile(null);
    useSessionStore.getState().setUserId(null);
    let root = navigation;
    while (root.getParent()) root = root.getParent();
    root.reset({ index: 0, routes: [{ name: 'Auth' }] });
  }

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
        {saved.length ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionTitle}>Saved providers</Text>
            {saved.map((p) => (
              <View key={p.id} style={styles.savedRow}>
                <Avatar initials={p.initials} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.savedName}>{p.full_name}</Text>
                  <View style={styles.savedMetaRow}>
                    <Text style={styles.savedMeta}>{p.provider_category} ·</Text>
                    <Star color={colors.ink} fill={colors.ink} size={10} strokeWidth={2} />
                    <Text style={styles.savedMeta}>{p.provider_rating.toFixed(1)} · {p.provider_distance_km} km</Text>
                  </View>
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => toggleSaved.mutate({ customerId: profile.id, providerId: p.id, saved: true })}
                >
                  <Heart size={17} strokeWidth={2} color={colors.active} fill={colors.active} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.settingsCard}>
          {SETTINGS_ROWS.map((row, i) => (
            <Pressable
              key={row.label}
              onPress={() => navigation.navigate(row.screen)}
              style={[styles.settingsRow, i < SETTINGS_ROWS.length - 1 && styles.settingsRowBorder]}
            >
              <Text style={styles.settingsLabel}>{row.label}</Text>
              <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={handleSignOut} style={styles.resetRow}>
          <Text style={styles.resetLabel}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: spacing.lg,
    backgroundColor: colors.card,
  },
  identity: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  name: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.ink },
  meta: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
  roleSwitch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.lg, backgroundColor: colors.paperDim },
  rolePill: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
  rolePillActive: { backgroundColor: colors.white },
  rolePillText: { fontSize: 14, fontFamily: fonts.bold, color: colors.inkFaint },
  rolePillTextActive: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  body: { padding: spacing.lg, gap: spacing.xl },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  savedRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  savedName: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  savedMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  savedMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
  divider: { height: 1, backgroundColor: colors.hairline },
  settingsCard: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  settingsLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  resetRow: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    gap: 3,
  },
  resetLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
});
