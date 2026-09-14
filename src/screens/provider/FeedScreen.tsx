import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { ArrowUpRight, Check, ChevronRight, Search, X } from 'lucide-react-native';
import { useDismissOpportunity, useFeedRequests } from '../../api/requests';
import { useProviderJobs } from '../../api/jobs';
import { isApiConfigured } from '../../lib/api';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useLocale } from '../../i18n';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const DECLINE_REASONS = ['Too far', 'Budget too low', 'Wrong trade', 'Not available', 'Other'];
const LIVE_JOB_STATUSES = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
}

// Same visual language as the customer Home screen: an orange hero card
// (greeting, search, one primary action, a live-activity banner) above a
// section-headed list of cards. The list itself is this screen's own
// thing - nearby requests, not providers or categories - but the
// surrounding structure and every token (radii, shadow, spacing, the
// active-accent CTA) are lifted straight from HomeScreen.tsx rather than
// reinvented, so the app's two "home" screens actually feel like the same
// app.
export function FeedScreen({ navigation }: { navigation: any }) {
  const { colors, scheme } = useTheme();
  const { t } = useLocale();
  const styles = makeStyles(colors, scheme);
  const isDark = scheme === 'dark';
  const profile = useSessionStore((s) => s.profile);
  const { data: requests = [], isLoading, isError, refetch, isFetching } = useFeedRequests(
    profile?.id ?? null,
  );
  const { data: jobs = [], refetch: refetchJobs } = useProviderJobs(profile?.id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetch(), refetchJobs()]);
  });
  const dismissOpportunity = useDismissOpportunity();
  const [dismissTargetId, setDismissTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const activeJob = jobs.find((j) => LIVE_JOB_STATUSES.includes(j.status)) ?? null;

  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter(
      (r) => r.category_label.toLowerCase().includes(needle) || r.location_label.toLowerCase().includes(needle),
    );
  }, [requests, search]);

  function handleDismiss(reason?: string) {
    if (!profile || !dismissTargetId) return;
    dismissOpportunity.mutate({ requestId: dismissTargetId, providerId: profile.id, reason });
    setDismissTargetId(null);
  }

  return (
    <Screen edges={['top']} bg={colors.paper}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGreetRow}>
            <View style={styles.heroGreetText}>
              <Text style={styles.heroGreeting}>{t('home.greeting')}, {firstName}</Text>
              <Text style={styles.heroLocation}>
                {profile?.area ?? 'Accra'}
                {isApiConfigured() ? ' · matched opportunities' : ' · within 5 km'}
              </Text>
            </View>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.headerAvatarImage} />
            ) : (
              <Avatar initials={firstName.charAt(0).toUpperCase()} size={38} />
            )}
          </View>

          <View style={styles.heroSearch}>
            <Search color={colors.white} size={18} strokeWidth={2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search nearby requests"
              placeholderTextColor={'rgba(255,255,255,0.72)'}
              returnKeyType="search"
              style={styles.heroSearchInput}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.heroCta, pressed && styles.heroCtaPressed]}
            onPress={() => navigation.navigate('JobsTab', { screen: 'JobsHome' })}
          >
            <Text style={styles.heroCtaLabel}>View my jobs</Text>
            <ArrowUpRight color={isDark ? colors.white : colors.active} size={18} strokeWidth={2.4} />
          </Pressable>

          {activeJob ? (
            <Pressable
              style={({ pressed }) => [styles.heroActivity, pressed && styles.heroActivityPressed]}
              onPress={() => navigation.navigate('JobsTab', { screen: 'JobDetail', params: { jobId: activeJob.id } })}
              accessibilityRole="button"
              accessibilityLabel={`View active job: ${activeJob.title}`}
            >
              <View style={styles.heroActivityTopRow}>
                <Text style={styles.heroActivityEyebrow}>
                  {activeJob.status === 'awaiting_completion_confirmation'
                    ? 'AWAITING CUSTOMER'
                    : activeJob.status === 'accepted'
                      ? 'JOB READY'
                      : 'JOB IN PROGRESS'}
                </Text>
                <View style={styles.heroActivityAction}>
                  <Text style={styles.heroActivityActionText}>Track job</Text>
                  <ChevronRight color={colors.ink} size={13} strokeWidth={2.5} />
                </View>
              </View>
              <Text style={styles.heroActivityTitle}>{activeJob.title}</Text>
              <Text style={styles.heroActivityDetail}>
                {activeJob.status === 'awaiting_completion_confirmation'
                  ? 'Waiting for the customer to confirm completion'
                  : activeJob.status === 'accepted'
                    ? 'Ready to start when you are'
                    : `In progress · ${activeJob.location_label}`}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Nearby requests</Text>
          <Text style={styles.sectionCount}>{filteredRequests.length} available</Text>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.loadingText}>Loading opportunities…</Text>
          </View>
        ) : isError ? (
          <EmptyState title="Couldn't load feed" subtitle="Check your connection, then try again." />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title={requests.length ? 'No matches' : 'No requests yet'}
            subtitle={
              requests.length
                ? 'Try a different search.'
                : "When customers nearby post a matching job — or send you a direct request — they'll show up here."
            }
          />
        ) : (
          filteredRequests.map((r) => {
            // Not-interested tracking only applies to general opportunities
            // a provider can silently skip - a DIRECT request already has
            // its own reject flow (with a required reason) inside Request
            // Detail, and there's nothing to dismiss once a quote is sent.
            const canDismiss = !r.myQuote && r.request_mode !== 'DIRECT' && r.status !== 'awaiting_provider';
            return (
              <Pressable
                key={r.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => navigation.navigate('RequestDetail', { requestId: r.id })}
              >
                <View style={styles.cardTop}>
                  <View style={{ gap: 3, flex: 1 }}>
                    <Text style={styles.cardTitle}>{r.category_label.split('·').pop()?.trim()}</Text>
                    <Text style={styles.cardMeta}>
                      {r.location_label} · {timeAgo(r.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.cardBudget}>
                    GHS {r.customer_budget ?? r.budget_min}
                    {r.budget_max != null && r.budget_max !== r.budget_min ? `-${r.budget_max}` : ''}
                  </Text>
                  {canDismiss ? (
                    <Pressable
                      hitSlop={10}
                      style={styles.dismissBtn}
                      onPress={() => setDismissTargetId(r.id)}
                      accessibilityLabel="Not interested"
                    >
                      <X size={14} strokeWidth={2.4} color={colors.inkFaint} />
                    </Pressable>
                  ) : null}
                </View>
                {r.myQuote ? (
                  <Badge
                    label="Quote sent"
                    bg={colors.confirmBg}
                    fg={colors.confirm}
                    icon={<Check size={11} strokeWidth={3} color={colors.confirm} />}
                  />
                ) : r.request_mode === 'DIRECT' || r.status === 'awaiting_provider' ? (
                  <Badge label="Direct request" bg={colors.navyBg} fg={colors.navy} />
                ) : (
                  <Badge
                    label={r.category_label.split('·')[0]?.trim() ?? ''}
                    bg={colors.paperDim}
                    fg={colors.inkMuted}
                  />
                )}
              </Pressable>
            );
          })
        )}
        {isError ? (
          <Pressable onPress={() => refetch()} style={styles.retry} disabled={isFetching}>
            <Text style={styles.retryLabel}>{isFetching ? 'Retrying…' : 'Try again'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <BottomSheet visible={!!dismissTargetId} onClose={() => setDismissTargetId(null)}>
        <Text style={styles.sheetTitle}>Not interested?</Text>
        <Text style={styles.sheetSubtitle}>Optional - helps us send you better matches.</Text>
        <View style={styles.reasonList}>
          {DECLINE_REASONS.map((reason) => (
            <Pressable key={reason} style={styles.reasonRow} onPress={() => handleDismiss(reason)}>
              <Text style={styles.reasonLabel}>{reason}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.reasonRow} onPress={() => handleDismiss(undefined)}>
            <Text style={[styles.reasonLabel, { color: colors.inkFaint }]}>Skip, just remove it</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], scheme: ReturnType<typeof useTheme>['scheme']) {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.paper },
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 112, gap: spacing.xl },

    // Identical shape/shadow/radius to HomeScreen's own heroCard - same
    // orange surface, same "greeting + search + one action + activity"
    // rhythm, just filled with a provider's own content.
    heroCard: {
      backgroundColor: colors.active,
      borderRadius: radii.xxxl,
      padding: spacing.lg,
      gap: spacing.lg,
      shadowColor: colors.black,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    heroGreetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerAvatarImage: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    heroGreetText: { flex: 1, gap: 3 },
    heroGreeting: { color: colors.white, fontSize: 19, letterSpacing: -0.4, fontFamily: fonts.extrabold },
    heroLocation: { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, fontFamily: fonts.medium },

    heroSearch: {
      height: 48,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.34)',
    },
    heroSearchInput: { flex: 1, color: colors.white, fontSize: 14, fontFamily: fonts.medium, padding: 0 },

    heroCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: isDark ? colors.black : colors.white,
      borderRadius: radii.lg,
      height: 50,
    },
    heroCtaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
    heroCtaLabel: { color: isDark ? colors.white : colors.active, fontSize: 15, fontFamily: fonts.bold },

    heroActivity: {
      padding: spacing.md,
      gap: 6,
      borderRadius: radii.lg,
      backgroundColor: colors.paperDim,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    heroActivityPressed: { backgroundColor: colors.hairline },
    heroActivityTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
    heroActivityEyebrow: { color: colors.pending, fontSize: 10, letterSpacing: 0.7, fontFamily: fonts.extrabold },
    heroActivityAction: { flexDirection: 'row', alignItems: 'center', gap: 1 },
    heroActivityActionText: { color: colors.ink, fontSize: 12.5, fontFamily: fonts.bold },
    heroActivityTitle: { color: colors.ink, fontSize: 14.5, letterSpacing: -0.2, fontFamily: fonts.bold },
    heroActivityDetail: { color: colors.inkMuted, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.medium },

    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    sectionTitle: { color: colors.ink, fontSize: 16.5, letterSpacing: -0.3, fontFamily: fonts.bold },
    sectionCount: { color: colors.inkFaint, fontSize: 12, fontFamily: fonts.medium },

    loading: { alignItems: 'center', gap: spacing.md, paddingVertical: 64 },
    loadingText: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },

    // Shadow-lifted, no hairline border - matches Home's card discipline
    // (TopProviderCard, filterEmpty) instead of the flat bordered box this
    // screen used before.
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    cardPressed: { opacity: 0.92 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    cardMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    cardBudget: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    retry: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    retryLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },

    dismissBtn: {
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
      marginLeft: spacing.sm,
    },
    sheetTitle: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.ink },
    sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, marginTop: 2, marginBottom: spacing.sm },
    reasonList: { gap: 2 },
    reasonRow: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline },
    reasonLabel: { fontSize: 15, fontFamily: fonts.medium, color: colors.ink },
  });
}
