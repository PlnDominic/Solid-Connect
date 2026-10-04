import { useCallback, useState } from 'react';
import { Share2, Users } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  referralDeepLink,
  useReferralSummary,
  type ReferralSummary,
} from '../../api/referrals';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const STATUS_LABEL: Record<ReferralSummary['invited'][number]['status'], string> = {
  pending: 'First job pending',
  earned: 'Credit earned',
  paid: 'Credit paid',
};

/**
 * Invite friends. The code and ledger live server-side
 * (supabase/migrations/0060_referral_rewards.sql); this screen shows the
 * real code, who joined, and credit earned on their first completed job.
 * Credit is paid out with real payouts (Phase G) - the copy says so.
 */
export function ReferralScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: summary, isLoading } = useReferralSummary(Boolean(profile));

  const handleShare = useCallback(async () => {
    const code = summary?.code;
    if (!code) return;
    try {
      await Share.share({
        message: `Join me on Solid Connect - trusted home services in Accra. Use my invite code ${code} when you sign up: ${referralDeepLink(code)}`,
      });
    } catch {
      Alert.alert('Could not open share sheet', 'Copy your invite code manually: ' + code);
    }
  }, [summary?.code]);

  const code = summary?.code ?? '········';

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Invite friends" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lead}>
          Grow the marketplace. When friends join with your code and complete their first job, you earn GHS 10 credit.
        </Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
          <Text style={styles.codeValue}>{code}</Text>
        </View>
        <Pressable
          style={styles.shareBtn}
          onPress={handleShare}
          disabled={!summary?.code}
          accessibilityRole="button"
          accessibilityLabel="Share invite code"
        >
          <Share2 size={16} strokeWidth={2.2} color={colors.white} />
          <Text style={styles.shareLabel}>Share invite</Text>
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary?.joinedCount ?? 0}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary?.earnedCount ?? 0}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>GHS {summary?.earnedAmount ?? 0}</Text>
            <Text style={styles.statLabel}>Credit</Text>
          </View>
        </View>

        {(summary?.invited.length ?? 0) > 0 && (
          <View style={styles.cardShadow}>
            <View style={styles.card}>
              {summary!.invited.map((invite, i) => (
                <View key={`${invite.name}-${invite.createdAt}`} style={[styles.row, i < summary!.invited.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowLabel}>{invite.name}</Text>
                    <Text style={styles.rowDetail}>{STATUS_LABEL[invite.status]}</Text>
                  </View>
                  <View style={[styles.statusDot, invite.status !== 'pending' && styles.statusDotEarned]} />
                </View>
              ))}
            </View>
          </View>
        )}

        {isLoading ? null : (summary?.invited.length ?? 0) === 0 ? (
          <View style={styles.emptyRow}>
            <Users size={18} strokeWidth={2} color={colors.inkFaint} />
            <Text style={styles.emptyText}>No invites yet - share your code to get started.</Text>
          </View>
        ) : null}

        <Text style={styles.note}>
          Credit is paid out with your next payout once real payouts are live. One reward per friend, on their first completed job.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    lead: { fontSize: fontSizes.md, lineHeight: 24, fontFamily: fonts.regular, color: colors.inkMuted },
    codeCard: {
      borderRadius: radii.xl,
      backgroundColor: colors.navy,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    codeLabel: { fontSize: fontSizes.xs, fontFamily: fonts.extrabold, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.8 },
    codeValue: { fontSize: fontSizes.display, fontFamily: fonts.mono, color: colors.white, letterSpacing: 2 },
    shareBtn: {
      height: 52,
      borderRadius: radii.lg,
      backgroundColor: colors.ink,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      opacity: 1,
    },
    shareLabel: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.paper },
    statsRow: { flexDirection: 'row', gap: spacing.md },
    statCard: {
      flex: 1,
      borderRadius: radii.xxxl,
      backgroundColor: colors.card,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: 2,
      ...shadow.card,
    },
    statValue: { fontSize: fontSizes.xl, fontFamily: fonts.extrabold, color: colors.ink },
    statLabel: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkFaint, letterSpacing: 0.4 },
    cardShadow: { borderRadius: radii.xxxl, backgroundColor: colors.card, ...shadow.card },
    card: { borderRadius: radii.xxxl, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    rowLabel: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.ink },
    rowDetail: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkFaint },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.hairlineStrong },
    statusDotEarned: { backgroundColor: colors.successStrong },
    emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
    emptyText: { fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.inkFaint },
    note: { fontSize: fontSizes.sm, lineHeight: 21, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
