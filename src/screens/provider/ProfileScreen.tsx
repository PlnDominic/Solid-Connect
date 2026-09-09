import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Camera,
  Clock,
  FileText,
  Images,
  KeyRound,
  LifeBuoy,
  MapPin,
  Moon,
  ShieldCheck,
  Star,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderEarningsThisMonth } from '../../api/jobs';
import { useProviderReviews } from '../../api/reviews';
import { useSwitchRole, useUploadProfilePhoto } from '../../api/profile';
import { usePortfolioPhotos } from '../../api/portfolio';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { ReviewCard } from '../../components/ReviewCard';
import { Screen } from '../../components/Screen';
import { signOut } from '../../lib/auth';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { isIdentityVerified, verificationLevelLabel } from '../../lib/verification';

type SettingsRow = { label: string; screen: string; icon: LucideIcon };

// Grouped by what the row actually is, not by an arbitrary split - each
// group has one reason to exist, named so that reason is legible on screen.
const SETTINGS_SECTIONS: { title: string; rows: SettingsRow[] }[] = [
  {
    title: 'Account',
    rows: [
      { label: 'Edit profile', screen: 'EditProfile', icon: UserCog },
      { label: 'Account security', screen: 'AccountSecurity', icon: KeyRound },
      { label: 'Payout details', screen: 'PayoutDetails', icon: Wallet },
    ],
  },
  {
    title: 'Business',
    rows: [
      { label: 'Verification', screen: 'Verification', icon: ShieldCheck },
      { label: 'Portfolio', screen: 'Portfolio', icon: Images },
      { label: 'Service areas', screen: 'ServiceAreas', icon: MapPin },
      { label: 'Availability', screen: 'Availability', icon: Clock },
    ],
  },
  {
    title: 'Preferences',
    rows: [{ label: 'Appearance', screen: 'Appearance', icon: Moon }],
  },
  {
    title: 'More',
    rows: [
      { label: 'Invite friends', screen: 'Referral', icon: Users },
      { label: 'Terms & privacy', screen: 'Legal', icon: FileText },
      { label: 'Help & support', screen: 'HelpSupport', icon: LifeBuoy },
    ],
  },
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
  const uploadPhoto = useUploadProfilePhoto();
  const [photoError, setPhotoError] = useState<string | null>(null);

  if (!profile) return <Screen />;

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

  function confirmSignOut() {
    Alert.alert('Sign out?', "You'll need to sign in again to access your account.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);
  }

  // Real rating distribution from this provider's own reviews - same
  // computation the admin reviews page uses, not a decorative placeholder.
  const dist = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));
  const maxCount = Math.max(1, ...dist.map((d) => d.count));

  async function handlePickPhoto() {
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    try {
      await uploadPhoto.mutateAsync(result.assets[0].uri);
    } catch (e: any) {
      setPhotoError(e?.message ?? 'Could not upload your photo. Please try again.');
    }
  }

  return (
    <Screen edges={['top']} bg={colors.paperDim}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.heroScrim]} />

          <Pressable onPress={handlePickPhoto} style={styles.heroAvatarWrap} disabled={uploadPhoto.isPending}>
            {profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.heroAvatarImage} />
            ) : (
              <Avatar initials={profile.initials} size={72} fg={colors.white} dim />
            )}
            <View style={styles.heroCameraBadge}>
              {/* Badge sits on the always-dark hero, but its own fill is
                  `ink` (theme-relative) - icon must flip opposite it. */}
              {uploadPhoto.isPending ? (
                <ActivityIndicator size="small" color={colors.paper} />
              ) : (
                <Camera size={12} strokeWidth={2.4} color={colors.paper} />
              )}
            </View>
          </Pressable>

          <View style={styles.heroNameRow}>
            <Text style={styles.heroName}>{profile.full_name}</Text>
            {isIdentityVerified(profile) ? (
              <View style={styles.heroVerifiedDot}>
                <ShieldCheck size={11} strokeWidth={2.8} color={colors.white} />
              </View>
            ) : null}
          </View>
          {profile.tagline ? <Text style={styles.heroTagline}>{profile.tagline}</Text> : null}
          <Text style={styles.heroMeta}>{profile.provider_category} · {profile.area} · Since {memberSince(profile.created_at)}</Text>

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
          {photoError ? <Text style={styles.photoErrorText}>{photoError}</Text> : null}

          {isIdentityVerified(profile) || profile.provider_certified ? (
            <View style={styles.badgeRow}>
              {isIdentityVerified(profile) ? (
                <Badge
                  label={verificationLevelLabel(profile)}
                  bg={colors.confirmBg}
                  fg={colors.confirm}
                  icon={<ShieldCheck size={11} strokeWidth={2.8} color={colors.confirm} />}
                />
              ) : null}
              {profile.provider_certified || profile.verification_level === 'SOLID_CONNECT_VERIFIED' ? (
                <Badge
                  label="Solid Connect certified"
                  bg={colors.navy}
                  fg={colors.white}
                  icon={<ShieldCheck size={11} strokeWidth={2.8} color={colors.white} />}
                />
              ) : null}
            </View>
          ) : null}

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

          {SETTINGS_SECTIONS.map((section) => (
            <View key={section.title} style={styles.settingsCard}>
              {section.rows.map((row, i) => (
                <Pressable
                  key={row.label}
                  onPress={() => navigation.navigate(row.screen)}
                  style={[styles.settingsRow, i < section.rows.length - 1 && styles.settingsRowBorder]}
                >
                  <row.icon size={19} strokeWidth={1.8} color={colors.ink} />
                  <Text style={styles.settingsLabel}>{row.label}</Text>
                  <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
                </Pressable>
              ))}
            </View>
          ))}

          <Pressable onPress={confirmSignOut} style={styles.signOutRow} hitSlop={8}>
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    scroll: { flexGrow: 1 },

    hero: {
      minHeight: 280,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: spacing.xxl,
      justifyContent: 'flex-end',
      gap: 6,
      overflow: 'hidden',
    },
    heroPlaceholder: { backgroundColor: colors.navy },
    // Solid scrim (not a true gradient - no gradient dependency in this
    // project) over the lower two-thirds of the hero, enough contrast for
    // white text over any photo without needing a new library.
    heroScrim: { backgroundColor: 'rgba(11,11,10,0.38)' },

    heroAvatarWrap: {
      width: 72,
      height: 72,
      borderRadius: radii.xxl,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      overflow: 'visible',
    },
    heroAvatarImage: { width: '100%', height: '100%', borderRadius: radii.xl },
    heroCameraBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      backgroundColor: colors.ink,
      borderWidth: 2,
      borderColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },

    heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heroName: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.white, letterSpacing: -0.4 },
    heroVerifiedDot: { width: 18, height: 18, borderRadius: radii.pill, backgroundColor: colors.confirm, alignItems: 'center', justifyContent: 'center' },
    heroTagline: { fontSize: 13.5, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.88)', lineHeight: 19 },
    heroMeta: { fontSize: 12, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.65)' },

    roleSwitch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: spacing.sm, alignSelf: 'flex-start' },
    rolePill: { paddingVertical: 9, paddingHorizontal: spacing.lg, borderRadius: radii.md, alignItems: 'center' },
    rolePillActive: { backgroundColor: colors.white },
    rolePillText: { fontSize: 13, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.8)' },
    rolePillTextActive: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },

    body: { padding: spacing.lg, gap: spacing.xl },
    photoErrorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger },
    badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },

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

    settingsCard: { borderRadius: radii.xxxl, backgroundColor: colors.card, overflow: 'hidden' },
    settingsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: 15, paddingHorizontal: spacing.lg },
    settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    settingsLabel: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.ink },

    signOutRow: { paddingVertical: spacing.lg, alignItems: 'center' },
    signOutLabel: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.danger, letterSpacing: 0.2 },
  });
}
