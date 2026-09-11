import { useMemo, useState } from 'react';
import {
  Bell,
  Camera,
  ChevronRight,
  CreditCard,
  FileText,
  Heart,
  KeyRound,
  LifeBuoy,
  Moon,
  Star,
  UserCog,
  Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerJobsCount } from '../../api/jobs';
import { useSavedProviders, useToggleSavedProvider } from '../../api/saved';
import { useSwitchRole, useUploadProfilePhoto } from '../../api/profile';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { signOut } from '../../lib/auth';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

// Preview count shown inline on Profile; "See all" leads to the full,
// unlimited SavedProvidersScreen list.
const SAVED_PREVIEW_COUNT = 3;

type SettingsRow = { label: string; screen: string; icon: LucideIcon };

// Grouped by what the row actually is, not by an arbitrary split - each
// group has one reason to exist, named so that reason is legible on screen.
const SETTINGS_SECTIONS: { title: string; rows: SettingsRow[] }[] = [
  {
    title: 'Account',
    rows: [
      { label: 'Edit profile', screen: 'EditProfile', icon: UserCog },
      { label: 'Account security', screen: 'AccountSecurity', icon: KeyRound },
      { label: 'Payment methods', screen: 'PaymentMethods', icon: CreditCard },
    ],
  },
  {
    title: 'Preferences',
    rows: [
      { label: 'Notifications', screen: 'Notifications', icon: Bell },
      { label: 'Appearance', screen: 'Appearance', icon: Moon },
    ],
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
  const { data: jobsCount = 0 } = useCustomerJobsCount(profile?.id ?? null);
  const { data: saved = [] } = useSavedProviders(profile?.id ?? null);
  const switchRole = useSwitchRole();
  const toggleSaved = useToggleSavedProvider();
  const uploadPhoto = useUploadProfilePhoto();
  const [photoError, setPhotoError] = useState<string | null>(null);

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

  if (!profile) return <Screen />;

  async function handlePickPhoto() {
    if (!profile) return;
    setPhotoError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    try {
      await uploadPhoto.mutateAsync({ userId: profile.id, imageUri: result.assets[0].uri });
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

          <View style={styles.heroAvatarBadgeWrap}>
            <Pressable onPress={handlePickPhoto} style={styles.heroAvatarWrap} disabled={uploadPhoto.isPending}>
              {profile.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.heroAvatarImage} />
              ) : (
                <Avatar initials={profile.initials} size={72} fg={colors.white} dim />
              )}
            </Pressable>
            <View style={styles.heroCameraBadge}>
              {/* Badge sits on the always-dark hero, but its own fill is
                  `ink` (theme-relative) - icon must flip opposite it. */}
              {uploadPhoto.isPending ? (
                <ActivityIndicator size="small" color={colors.paper} />
              ) : (
                <Camera size={12} strokeWidth={2.4} color={colors.paper} />
              )}
            </View>
          </View>

          <Text style={styles.heroName}>{profile.full_name}</Text>
          {profile.tagline ? <Text style={styles.heroTagline}>{profile.tagline}</Text> : null}
          <Text style={styles.heroMeta}>{profile.area} · Customer since {memberSince(profile.created_at)}</Text>

          <View style={styles.roleSwitch}>
            <View style={[styles.rolePill, styles.rolePillActive]}>
              <Text style={styles.rolePillTextActive}>Customer</Text>
            </View>
            <Pressable style={styles.rolePill} onPress={() => switchRole.mutate({ userId: profile.id, role: 'provider' })}>
              <Text style={styles.rolePillText}>Provider</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {photoError ? <Text style={styles.photoErrorText}>{photoError}</Text> : null}

          {/* Statement card - same receipt-line-item treatment as the
              provider profile, so both sides share one quality bar. */}
          <View style={styles.statement}>
            <View style={styles.statementRow}>
              <Text style={styles.statementLabel}>Jobs posted</Text>
              <Text style={styles.statementValueLg}>{jobsCount}</Text>
            </View>
            <View style={[styles.statementRow, styles.statementRowBorder]}>
              <Text style={styles.statementLabel}>Saved providers</Text>
              <Text style={styles.statementValue}>{saved.length}</Text>
            </View>
          </View>

          {saved.length ? (
            <View style={{ gap: spacing.sm }}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Saved providers</Text>
                {saved.length > SAVED_PREVIEW_COUNT ? (
                  <Pressable onPress={() => navigation.navigate('SavedProviders')} hitSlop={10}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                ) : null}
              </View>
              {saved.slice(0, SAVED_PREVIEW_COUNT).map((p) => (
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
                    <Heart size={17} strokeWidth={2} color={colors.ink} fill={colors.ink} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

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
      minHeight: 260,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: spacing.xxl,
      justifyContent: 'flex-end',
      gap: 6,
      overflow: 'hidden',
    },
    heroPlaceholder: { backgroundColor: colors.navy },
    heroScrim: { backgroundColor: 'rgba(11,11,10,0.38)' },

    heroAvatarBadgeWrap: {
      position: 'relative',
      width: 72,
      height: 72,
      marginBottom: spacing.sm,
    },
    heroAvatarWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    heroAvatarImage: { width: '100%', height: '100%', borderRadius: 36 },
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

    heroName: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.white, letterSpacing: -0.4 },
    heroTagline: { fontSize: 13.5, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.88)', lineHeight: 19 },
    heroMeta: { fontSize: 12, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.65)' },

    roleSwitch: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: spacing.sm, alignSelf: 'flex-start' },
    rolePill: { paddingVertical: 9, paddingHorizontal: spacing.lg, borderRadius: radii.md, alignItems: 'center' },
    rolePillActive: { backgroundColor: colors.white },
    rolePillText: { fontSize: 13, fontFamily: fonts.bold, color: 'rgba(255,255,255,0.8)' },
    rolePillTextActive: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },

    body: { padding: spacing.lg, gap: spacing.xl },
    photoErrorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger },

    statement: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
    statementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.lg },
    statementRowBorder: { borderTopWidth: 1, borderTopColor: colors.hairline },
    statementLabel: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.inkMuted },
    statementValueLg: { fontSize: 20, fontFamily: fonts.mono, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
    statementValue: { fontSize: 16, fontFamily: fonts.mono, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },

    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    seeAll: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold, textDecorationLine: 'underline' },
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
    settingsCard: { borderRadius: radii.xxxl, backgroundColor: colors.card, overflow: 'hidden' },
    settingsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: 15, paddingHorizontal: spacing.lg },
    settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    settingsLabel: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.ink },

    signOutRow: { paddingVertical: spacing.lg, alignItems: 'center' },
    signOutLabel: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.danger, letterSpacing: 0.2 },
  });
}
