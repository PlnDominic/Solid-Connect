import { Check, ChevronRight, ShieldCheck, Star } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderEarningsThisMonth } from '../../api/jobs';
import { useSwitchRole } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Screen } from '../../components/Screen';
import { signOut } from '../../lib/auth';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

const SETTINGS_ROWS: { label: string; screen: string }[] = [
  { label: 'Edit profile', screen: 'EditProfile' },
  { label: 'Payout details', screen: 'PayoutDetails' },
  { label: 'Service areas', screen: 'ServiceAreas' },
  { label: 'Account & security', screen: 'AccountSecurity' },
  { label: 'Privacy & data', screen: 'PrivacyData' },
  { label: 'Legal', screen: 'Legal' },
  { label: 'Help & support', screen: 'HelpSupport' },
];

export function ProfileScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: earnings = 0 } = useProviderEarningsThisMonth(profile?.id ?? null);
  const switchRole = useSwitchRole();

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
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name}>{profile.full_name}</Text>
              {profile.provider_verified ? (
                <View style={styles.verifiedDot}>
                  <Check size={10} strokeWidth={3} color={colors.white} />
                </View>
              ) : null}
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{profile.provider_category} ·</Text>
              <Star color={colors.ink} fill={colors.ink} size={10} strokeWidth={2} />
              <Text style={styles.meta}>{profile.provider_rating.toFixed(1)} · {profile.provider_jobs_count} jobs</Text>
            </View>
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
            <View style={styles.statRatingRow}>
              <Text style={styles.statValue}>{profile.provider_rating.toFixed(1)}</Text>
              <Star color={colors.ink} fill={colors.ink} size={16} strokeWidth={2} />
            </View>
          </View>
        </View>

        {profile.provider_verified || profile.provider_certified ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {profile.provider_verified ? (
              <Badge
                label="Identity verified"
                bg={colors.confirmBg}
                fg={colors.confirm}
                icon={<ShieldCheck size={11} strokeWidth={2.8} color={colors.confirm} />}
              />
            ) : null}
            {profile.provider_certified ? (
              <Badge
                label="Solid Connect certified"
                bg={colors.navy}
                fg={colors.white}
                icon={<ShieldCheck size={11} strokeWidth={2.8} color={colors.white} />}
              />
            ) : null}
          </View>
        ) : null}

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
  verifiedDot: { width: 16, height: 16, borderRadius: radii.pill, backgroundColor: colors.confirm, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
  roleSwitch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.lg, backgroundColor: colors.paperDim },
  rolePill: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
  rolePillActive: { backgroundColor: colors.white },
  rolePillText: { fontSize: 14, fontFamily: fonts.bold, color: colors.inkFaint },
  rolePillTextActive: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  body: { padding: spacing.lg, gap: spacing.lg },
  statsGrid: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, gap: 4 },
  statLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
  statValue: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
  statRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  settingsCard: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  resetRow: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    gap: 3,
  },
  resetLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  settingsLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
});
