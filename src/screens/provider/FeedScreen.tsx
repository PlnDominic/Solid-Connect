import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import {
  ArrowUpRight,
  Ban,
  Check,
  ChevronRight,
  Clock,
  MapPinOff,
  MapPin,
  MoreHorizontal,
  Search,
  Send,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { fetchProviderCategories, type ProviderCategoryRow } from '../../api/identity';
import { coordsForLabel, distanceBetweenLabelsKm } from '../../api/location';
import { useDismissOpportunity, useFeedRequests, useProviderQuoteStats, useSendQuote } from '../../api/requests';
import type { FeedItem } from '../../api/requests';
import { useProviderJobs } from '../../api/jobs';
import { isApiConfigured } from '../../lib/api';
import { formatDistanceKm, openInMaps } from '../../lib/geo';
import { haptics } from '../../lib/haptics';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useLocale } from '../../i18n';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const DECLINE_REASONS: { reason: string; icon: LucideIcon }[] = [
  { reason: 'Too far', icon: MapPinOff },
  { reason: 'Budget too low', icon: Wallet },
  { reason: 'Wrong trade', icon: Wrench },
  { reason: 'Not available', icon: Clock },
  { reason: 'Other', icon: MoreHorizontal },
];
const LIVE_JOB_STATUSES = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = Math.round(mins % 60);
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
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
  const { data: quoteStats } = useProviderQuoteStats(profile?.id ?? null);
  const sendQuote = useSendQuote();
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetch(), refetchJobs()]);
  });
  const dismissOpportunity = useDismissOpportunity();
  const [dismissTargetId, setDismissTargetId] = useState<string | null>(null);
  const [quoteTargetId, setQuoteTargetId] = useState<string | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quotePriceFocused, setQuotePriceFocused] = useState(false);
  const [search, setSearch] = useState('');
  const [serviceRows, setServiceRows] = useState<ProviderCategoryRow[]>([]);
  const [tradeFilter, setTradeFilter] = useState('all');
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const activeJob = jobs.find((j) => LIVE_JOB_STATUSES.includes(j.status)) ?? null;

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProviderCategories(profile.id);
        if (!cancelled) setServiceRows(rows);
      } catch {
        if (!cancelled) setServiceRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // A new opportunity landing (realtime already invalidates the feed
  // query) gets a success buzz the same way a customer's "quote received"
  // does - but only once there's a real baseline to compare against, or
  // the very first load would buzz for every request that already existed.
  const seenRequestCount = useRef<number | null>(null);
  useEffect(() => {
    if (seenRequestCount.current != null && requests.length > seenRequestCount.current) {
      haptics.success();
    }
    seenRequestCount.current = requests.length;
  }, [requests.length]);

  const tradeNames = useMemo(
    () => serviceRows.map((r) => r.categories?.name).filter((n): n is string => !!n),
    [serviceRows],
  );
  const tradeFilterOptions: FilterOption[] = useMemo(
    () => [{ id: 'all', label: 'All' }, ...tradeNames.map((name) => ({ id: name, label: name }))],
    [tradeNames],
  );

  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (tradeFilter !== 'all' && !r.category_label.toLowerCase().includes(tradeFilter.toLowerCase())) return false;
      if (!needle) return true;
      return r.category_label.toLowerCase().includes(needle) || r.location_label.toLowerCase().includes(needle);
    });
  }, [requests, search, tradeFilter]);

  function distanceForRequest(r: FeedItem): number | null {
    if (r.distanceMeters != null) return r.distanceMeters / 1000;
    if (!profile?.area) return null;
    return distanceBetweenLabelsKm(profile.area, r.location_label);
  }

  function handleDismiss(reason?: string) {
    if (!profile || !dismissTargetId) return;
    dismissOpportunity.mutate({ requestId: dismissTargetId, providerId: profile.id, reason });
    setDismissTargetId(null);
  }

  function openQuoteSheet(requestId: string) {
    setQuoteError(null);
    setQuotePrice('');
    setQuoteTargetId(requestId);
  }

  async function handleSendQuote() {
    if (!profile || !quoteTargetId) return;
    const numeric = parseInt(quotePrice.replace(/[^\d]/g, ''), 10);
    if (!numeric || numeric <= 0) {
      setQuoteError('Enter a valid amount.');
      return;
    }
    setQuoteError(null);
    try {
      await sendQuote.mutateAsync({
        requestId: quoteTargetId,
        providerId: profile.id,
        price: numeric,
        etaLabel: 'Today, 2 hrs',
        badgeLabel: profile.provider_certified ? 'Certified' : 'Identity verified',
        badgeKind: profile.provider_certified ? 'certified' : 'verified',
      });
      haptics.success();
      setQuoteTargetId(null);
      setQuotePrice('');
    } catch (e: any) {
      setQuoteError(e?.message ?? 'Could not send that quote. Please try again.');
    }
  }

  function handleViewOnMap(locationLabel: string) {
    const coords = coordsForLabel(locationLabel);
    if (!coords) return;
    openInMaps(coords.lat, coords.lng, locationLabel);
  }

  const quoteTargetRequest = requests.find((r) => r.id === quoteTargetId) ?? null;

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

          {quoteStats && quoteStats.total > 0 ? (
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{quoteStats.acceptanceRate}%</Text>
                <Text style={styles.heroStatLabel}>ACCEPTANCE</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>
                  {quoteStats.avgResponseMins != null ? formatMinutes(quoteStats.avgResponseMins) : '—'}
                </Text>
                <Text style={styles.heroStatLabel}>AVG. RESPONSE</Text>
              </View>
            </View>
          ) : null}

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

        {tradeNames.length > 1 ? (
          <FilterChips options={tradeFilterOptions} value={tradeFilter} onChange={setTradeFilter} />
        ) : null}

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
                ? 'Try a different search or trade.'
                : "When customers nearby post a matching job — or send you a direct request — they'll show up here."
            }
            action={
              requests.length
                ? undefined
                : {
                    label: 'Check your service areas',
                    onPress: () => navigation.navigate('ProfileTab', { screen: 'ServiceAreas' }),
                  }
            }
          />
        ) : (
          filteredRequests.map((r) => {
            // Not-interested tracking (and quoting) only applies to
            // general opportunities a provider can act on freely - a
            // DIRECT request already has its own accept/reject flow
            // inside Request Detail, and there's nothing left to do once
            // a quote is already sent.
            const canRespond = !r.myQuote && r.request_mode !== 'DIRECT' && r.status !== 'awaiting_provider';
            const distanceKm = distanceForRequest(r);
            const mapCoords = coordsForLabel(r.location_label);
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
                      {r.location_label}
                      {distanceKm != null ? ` · ${formatDistanceKm(distanceKm)}` : ''} · {timeAgo(r.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.cardBudget}>
                    GHS {r.customer_budget ?? r.budget_min}
                    {r.budget_max != null && r.budget_max !== r.budget_min ? `-${r.budget_max}` : ''}
                  </Text>
                  {canRespond ? (
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

                <View style={styles.cardActions}>
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
                  <View style={{ flex: 1 }} />
                  {mapCoords ? (
                    <Pressable
                      hitSlop={8}
                      style={styles.mapBtn}
                      onPress={() => handleViewOnMap(r.location_label)}
                      accessibilityLabel={`View ${r.location_label} on map`}
                    >
                      <MapPin size={14} strokeWidth={2.2} color={colors.inkFaint} />
                    </Pressable>
                  ) : null}
                  {canRespond ? (
                    <Pressable
                      style={styles.quoteBtn}
                      onPress={() => openQuoteSheet(r.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Send a quick quote"
                    >
                      <Send size={12} strokeWidth={2.4} color={colors.white} />
                      <Text style={styles.quoteBtnLabel}>Quote</Text>
                    </Pressable>
                  ) : null}
                </View>
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
        <Text style={styles.dismissTitle}>Not interested?</Text>
        <Text style={styles.dismissSubtitle}>Optional - helps us send you better matches.</Text>

        <View style={styles.reasonList}>
          {DECLINE_REASONS.map(({ reason, icon: Icon }) => (
            <Pressable
              key={reason}
              style={({ pressed }) => [styles.reasonRow, pressed && styles.reasonRowPressed]}
              onPress={() => handleDismiss(reason)}
            >
              <View style={styles.reasonIcon}>
                <Icon size={16} strokeWidth={2} color={colors.inkFaint} />
              </View>
              <Text style={styles.reasonLabel}>{reason}</Text>
            </Pressable>
          ))}

          <Pressable
            style={({ pressed }) => [styles.reasonRow, styles.skipRow, pressed && styles.reasonRowPressed]}
            onPress={() => handleDismiss(undefined)}
          >
            <View style={styles.reasonIcon}>
              <Ban size={16} strokeWidth={2} color={colors.inkFaint} />
            </View>
            <Text style={styles.skipLabel}>Skip, just remove it</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={!!quoteTargetId}
        onClose={() => {
          setQuoteTargetId(null);
          setQuoteError(null);
        }}
      >
        <View style={styles.quoteHeader}>
          <View style={styles.quoteHeaderIcon}>
            <Send size={16} strokeWidth={2.2} color={colors.active} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Send a quote</Text>
            <Text style={styles.sheetSubtitle}>
              {quoteTargetRequest?.category_label.split('·').pop()?.trim() ?? 'This request'}
            </Text>
          </View>
        </View>

        {quoteTargetRequest ? (
          <Text style={styles.quoteBudgetHint}>
            Customer's budget: GHS {quoteTargetRequest.customer_budget ?? quoteTargetRequest.budget_min}
            {quoteTargetRequest.budget_max != null && quoteTargetRequest.budget_max !== quoteTargetRequest.budget_min
              ? `-${quoteTargetRequest.budget_max}`
              : ''}
          </Text>
        ) : null}

        <Text style={styles.quoteFieldLabel}>Your price</Text>
        <View style={[styles.quotePriceField, quotePriceFocused && styles.quotePriceFieldFocused]}>
          <Text style={styles.quotePriceCurrency}>GHS</Text>
          <TextInput
            value={quotePrice}
            onChangeText={setQuotePrice}
            onFocus={() => setQuotePriceFocused(true)}
            onBlur={() => setQuotePriceFocused(false)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.inkFainter}
            style={styles.quotePriceInput}
            autoFocus
          />
        </View>
        {quoteError ? <Text style={styles.quoteErrorText}>{quoteError}</Text> : null}
        <Button title="Send quote" variant="active" onPress={handleSendQuote} loading={sendQuote.isPending} />
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

    // Acceptance rate / avg. response scorecard - only shown once a
    // provider has sent at least one quote, so a brand-new account never
    // shows a misleading "0%".
    heroStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radii.lg,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      paddingVertical: spacing.sm,
    },
    heroStatItem: { flex: 1, alignItems: 'center', gap: 2 },
    heroStatValue: { color: colors.white, fontSize: 16, fontFamily: fonts.extrabold, fontVariant: ['tabular-nums'] },
    heroStatLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontFamily: fonts.extrabold, letterSpacing: 0.4 },
    heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.25)' },

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
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
    mapBtn: {
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
    },
    quoteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.active,
    },
    quoteBtnLabel: { color: colors.white, fontSize: 12.5, fontFamily: fonts.bold },

    sheetTitle: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.ink },
    sheetSubtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, marginTop: 2, marginBottom: spacing.sm },

    // Centered title/message, same register as Apple's own action sheet -
    // this sheet is a short list of choices, not a form, so it gets that
    // treatment specifically rather than this app's usual left-aligned
    // headers.
    dismissTitle: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.ink, textAlign: 'center' },
    dismissSubtitle: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: colors.inkMuted,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: spacing.lg,
    },
    // Each reason is its own small elevated card - not one grouped box
    // with hairline dividers - so every choice reads as its own tappable
    // surface, same shadow.card language as TopProviderCard and every
    // other floating card in this app.
    reasonList: { gap: spacing.sm },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      ...shadow.card,
    },
    reasonRowPressed: { opacity: 0.85 },
    reasonIcon: {
      width: 30,
      height: 30,
      borderRadius: radii.md,
      backgroundColor: colors.paperDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reasonLabel: { flex: 1, fontSize: 15.5, fontFamily: fonts.medium, color: colors.ink },
    // Visually separate from the reasons above by extra top spacing, same
    // convention Apple's own action sheets use for Cancel - its own row
    // below a gap, not just the last item in the same list.
    skipRow: { marginTop: spacing.sm, backgroundColor: colors.paperDim },
    skipLabel: { flex: 1, fontSize: 15.5, fontFamily: fonts.semibold, color: colors.inkFaint },

    quoteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    quoteHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.lg,
      backgroundColor: colors.navyBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quoteBudgetHint: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.inkFaint,
      backgroundColor: colors.paperDim,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginTop: spacing.lg,
    },
    quoteFieldLabel: {
      fontSize: 11,
      fontFamily: fonts.extrabold,
      color: colors.inkFaint,
      letterSpacing: 0.6,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    // Hairline at rest, ink on focus - same crafted treatment as
    // NewRequestScreen's own budget field, instead of a permanently-bold
    // border that looks "active" whether or not it actually is.
    quotePriceField: {
      height: 56,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    quotePriceFieldFocused: { borderWidth: 1.5, borderColor: colors.ink },
    quotePriceCurrency: { color: colors.inkFaint, marginRight: 6, fontSize: 17, fontFamily: fonts.medium },
    quotePriceInput: { flex: 1, fontSize: 22, fontFamily: fonts.mono, color: colors.ink },
    quoteErrorText: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.md },
  });
}
