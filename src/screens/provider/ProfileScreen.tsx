import { Check, ChevronRight, ShieldCheck, Star } from 'lucide-react-native';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderEarningsThisMonth } from '../../api/jobs';
import { useProviderReviews } from '../../api/reviews';
import { useSwitchRole } from '../../api/profile';
import { usePortfolioPhotos } from '../../api/portfolio';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { ReviewCard } from '../../components/ReviewCard';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const SETTINGS_ROWS: { label: string; screen: string }[] = [
  { label: 'Edit profile', screen: 'EditProfile' },
  { label: 'Verification', screen: 'Verification' },
  { label: 'Payout details', screen: 'PayoutDetails' },
  { label: 'Service areas', screen: 'ServiceAreas' },
  { label: 'Appearance', screen: 'Appearance' },
  { label: 'Account security', screen: 'AccountSecurity' },
  { label: 'Invite friends', screen: 'Referral' },
  { label: 'Terms & privacy', screen: 'Legal' },
  { label: 'Help & support', screen: 'HelpSupport' },
];

function memberSince(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function ProfileScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useSessionStore((s) => s.profile);
  const { data: earnings = 0 } = useProviderEarningsThisMonth(profile?.id ?? null);
  const { data: reviews = [] } = useProviderReviews(profile?.id ?? null);
  const { data: portfolio = [] } = usePortfolioPhotos(profile?.id);
  const switchRole = useSwitchRole();

  if (!profile) return <Screen />;

  // Real rating distribution from this provider's own reviews - same
  // computation the admin reviews page uses, not a decorative placeholder.
  const dist = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));
  const maxCount = Math.max(1, ...dist.map((d) => d.count));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <Avatar initials={profile.initials} size={64} />
            <View style={{ gap: 4, flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profile.full_name}</Text>
                {profile.provider_verified ? (
                  <View style={styles.verifiedDot}>
                    <Check size={10} strokeWidth={3} color={colors.white} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.meta}>{profile.provider_category} · {profile.area}</Text>
              <Text style={styles.since}>Provider since {memberSince(profile.created_at)}</Text>
            </View>
          </View>

          {profile.provider_verified || profile.provider_certified ? (
            <View style={styles.badgeRow}>
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

          <View style={styles.roleSwitch}>
            <Pressable style={styles.rolePill} onPress={() => switchRole.mutate('customer')}>
              <Text style={styles.rolePillText}>Customer</Text>
            </Pressable>
            <View style={[styles.rolePill, styles.rolePillActive]}>
              <Text style={styles.rolePillTextActive}>Provider</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Statement card - a receipt's line items, not a dashboard's
              same-size stat boxes: label left, value right, hairlines
              between rows, the month's headline figure set apart by weight. */}
          <View style={styles.statement}>
            <View style={styles.statementRow}>
              <Text style={styles.statementLabel}>This month</Text>
              <Text style={styles.statementValueLg}>GHS {earnings.toLocaleString()}</Text>
            </View>
            <View style={[styles.statementRow, styles.statementRowBorder]}>
              <Text style={styles.statementLabel}>Rating</Text>
              <View style={styles.statementRatingValue}>
                <Text style={styles.statementValue}>{profile.provider_rating.toFixed(1)}</Text>
                <Star color={colors.ink} fill={colors.ink} size={14} strokeWidth={2} />
              </View>
            </View>
            <View style={[styles.statementRow, styles.statementRowBorder]}>
              <Text style={styles.statementLabel}>Jobs completed</Text>
              <Text style={styles.statementValue}>{profile.provider_jobs_count}</Text>
            </View>
          </View>

          {portfolio.length ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sectionHeading}>Portfolio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {portfolio.map((p) => (
                  <Image key={p.id} source={{ uri: p.photo_url }} style={styles.portfolioThumb} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.reviewsSection}>
            <Text style={styles.sectionHeading}>Reviews</Text>
            {reviews.length ? (
              <>
                <View style={styles.distCard}>
                  {dist.map((d) => (
                    <View key={d.stars} style={styles.distRow}>
                      <Text style={styles.distLabel}>{d.stars}</Text>
                      <Star color={colors.inkFaint} fill={colors.inkFaint} size={10} strokeWidth={2} />
                      <View style={styles.distTrack}>
                        <View style={[styles.distFill, { width: `${(d.count / maxCount) * 100}%` }]} />
                      </View>
                      <Text style={styles.distCount}>{d.count}</Text>
                    </View>
                  ))}
                </View>
                {reviews.slice(0, 5).map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </>
            ) : (
              <EmptyState title="No reviews yet" subtitle="Complete a job and get rated to build your record." icon={Star} />
            )}
          </View>

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
        </View>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    scroll: { flexGrow: 1 },
    header: {
      padding: spacing.lg,
      paddingBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairline,
      gap: spacing.lg,
      backgroundColor: colors.card,
    },
    identity: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.3 },
    verifiedDot: { width: 16, height: 16, borderRadius: radii.pill, backgroundColor: colors.confirm, alignItems: 'center', justifyContent: 'center' },
    meta: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
    since: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFainter },
    badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    roleSwitch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.lg, backgroundColor: colors.paperDim },
    rolePill: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center' },
    rolePillActive: { backgroundColor: colors.card },
    rolePillText: { fontSize: 14, fontFamily: fonts.bold, color: colors.inkFaint },
    rolePillTextActive: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },

    body: { padding: spacing.lg, gap: spacing.xl },

    statement: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
    statementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.lg },
    statementRowBorder: { borderTopWidth: 1, borderTopColor: colors.hairline },
    statementLabel: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.inkMuted },
    statementValueLg: { fontSize: 20, fontFamily: fonts.mono, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
    statementValue: { fontSize: 16, fontFamily: fonts.mono, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
    statementRatingValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },

    sectionHeading: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6, textTransform: 'uppercase' },

    portfolioThumb: { width: 84, height: 84, borderRadius: radii.md, backgroundColor: colors.paperDim },

    reviewsSection: { gap: spacing.sm },
    distCard: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.md, gap: 7 },
    distRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    distLabel: { fontSize: 11, fontFamily: fonts.semibold, color: colors.inkMuted, width: 8, textAlign: 'right' },
    distTrack: { flex: 1, height: 5, borderRadius: radii.pill, backgroundColor: colors.paperDim, overflow: 'hidden' },
    distFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.ink },
    distCount: { fontSize: 11, fontFamily: fonts.mono, color: colors.inkFaint, width: 16, textAlign: 'right' },

    settingsCard: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
    settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    settingsLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  });
}
