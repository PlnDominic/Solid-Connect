import { useState } from 'react';
import { Check, ChevronRight, Clock, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderEarningsThisMonth, useProviderJobs } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useProviderRequestHistory, type ProviderRequestHistoryItem, type ProviderRequestStatus } from '../../api/requests';
import { useProviderReviewedJobIds } from '../../api/reviews';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { JobStatusBadge } from '../../components/JobStatusBadge';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Job } from '../../types/database';

type Section = 'quoted' | 'active' | 'completed';

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function isPending(status: ProviderRequestStatus) {
  return status === 'awaiting_response' || status === 'quote_sent';
}

function isLost(status: ProviderRequestStatus) {
  return status === 'quote_declined' || status === 'direct_declined';
}

function isPastJob(job: Job) {
  return job.status === 'completed' || job.status === 'cancelled';
}

function StatusBadge({ status }: { status: ProviderRequestStatus }) {
  const { colors } = useTheme();
  switch (status) {
    case 'awaiting_response':
      return <Badge label="Awaiting your response" bg={colors.navyBg} fg={colors.navy} icon={<Clock size={11} strokeWidth={2.6} color={colors.navy} />} />;
    case 'quote_sent':
      return <Badge label="Quote sent" bg={colors.confirmBg} fg={colors.confirm} icon={<Check size={11} strokeWidth={3} color={colors.confirm} />} />;
    case 'quote_accepted':
      return <Badge label="Accepted" bg={colors.confirmBg} fg={colors.confirm} icon={<Check size={11} strokeWidth={3} color={colors.confirm} />} />;
    case 'quote_declined':
      return <Badge label="Not selected" bg={colors.dangerBg} fg={colors.danger} icon={<X size={11} strokeWidth={3} color={colors.danger} />} />;
    case 'direct_declined':
      return <Badge label="Declined" bg={colors.dangerBg} fg={colors.danger} icon={<X size={11} strokeWidth={3} color={colors.danger} />} />;
  }
}

function RequestCard({ item, onPress }: { item: ProviderRequestHistoryItem; onPress?: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress && styles.cardPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.cardTop}>
        <View style={{ gap: 3, flex: 1 }}>
          <Text style={styles.cardTitle}>{item.request.category_label.split('·').pop()?.trim()}</Text>
          <Text style={styles.cardMeta}>
            {item.request.location_label} · {timeAgo(item.updatedAt)}
          </Text>
        </View>
        {item.price != null ? <Text style={styles.cardBudget}>GHS {item.price}</Text> : null}
      </View>
      <StatusBadge status={item.myStatus} />
    </Pressable>
  );
}

function JobRow({ job, onPress, needsRating }: { job: Job; onPress: () => void; needsRating?: boolean }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: customer } = useProvider(job.customer_id);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.cardTop}>
        <Avatar initials={customer?.initials ?? 'CU'} photoUrl={customer?.photo_url} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {customer?.full_name ?? 'Customer'} · {job.location_label}
          </Text>
        </View>
        <Text style={styles.cardBudget}>GHS {job.price.toLocaleString()}</Text>
      </View>
      <View style={styles.cardBottomRow}>
        <JobStatusBadge status={job.status} role="provider" />
        {needsRating ? <Text style={styles.rateNudge}>Rate customer</Text> : null}
        <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
      </View>
    </Pressable>
  );
}

/**
 * The provider's Work tab: what used to be two tabs (My Requests and Jobs)
 * as one place, following a piece of work from quote to payout.
 * - Quoted: quotes sent and direct requests awaiting a reply
 * - Active: jobs won and under way, with this month's earnings
 * - Completed: finished and cancelled jobs, plus quotes that weren't picked
 * A won quote isn't listed separately - it is the job under Active.
 */
export function WorkScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const userId = profile?.id ?? null;
  const [section, setSection] = useState<Section>('active');

  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useProviderRequestHistory(userId);
  const { data: jobs = [], isLoading: jobsLoading, refetch: refetchJobs } = useProviderJobs(userId);
  const { data: earnings } = useProviderEarningsThisMonth(userId);
  const { data: reviewedJobIds } = useProviderReviewedJobIds(userId);
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetchHistory(), refetchJobs()]);
  });

  const pending = history.filter((i) => isPending(i.myStatus));
  const lost = history.filter((i) => isLost(i.myStatus));
  const activeJobs = jobs.filter((j) => !isPastJob(j));
  const pastJobs = jobs.filter(isPastJob);

  const sections: FilterOption[] = [
    { id: 'quoted', label: pending.length ? `Quoted · ${pending.length}` : 'Quoted' },
    { id: 'active', label: activeJobs.length ? `Active · ${activeJobs.length}` : 'Active' },
    { id: 'completed', label: 'Completed' },
  ];

  const loading = section === 'quoted' ? historyLoading : section === 'active' ? jobsLoading : historyLoading || jobsLoading;
  const isEmpty =
    section === 'quoted'
      ? pending.length === 0
      : section === 'active'
        ? activeJobs.length === 0
        : pastJobs.length === 0 && lost.length === 0;

  return (
    <Screen>
      <ScreenHeader title="Work" large />
      <View style={styles.filtersWrap}>
        <FilterChips options={sections} value={section} onChange={(id) => setSection(id as Section)} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, !loading && isEmpty && styles.bodyEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        {section === 'active' && earnings != null && earnings > 0 ? (
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>EARNED THIS MONTH</Text>
            <Text style={styles.statsValue}>GHS {earnings.toLocaleString()}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : isEmpty ? (
          section === 'quoted' ? (
            <EmptyState
              title="No open quotes"
              subtitle="Quotes you send and direct requests waiting on you show up here."
              action={{ label: 'Go to Feed', onPress: () => navigation.navigate('FeedTab', { screen: 'Feed' }) }}
            />
          ) : section === 'active' ? (
            <EmptyState
              title="No jobs under way"
              subtitle="Send a quote from Feed or the Map - it becomes a job here once a customer accepts it."
              action={{ label: 'Go to Feed', onPress: () => navigation.navigate('FeedTab', { screen: 'Feed' }) }}
            />
          ) : (
            <EmptyState title="Nothing finished yet" subtitle="Completed jobs and quotes that weren't picked show up here." />
          )
        ) : section === 'quoted' ? (
          <View style={styles.cardList}>
            {pending.map((item) => (
              <RequestCard
                key={item.request.id}
                item={item}
                onPress={() =>
                  navigation.navigate('FeedTab', { screen: 'RequestDetail', params: { requestId: item.request.id } })
                }
              />
            ))}
          </View>
        ) : section === 'active' ? (
          <View style={styles.cardList}>
            {activeJobs.map((job) => (
              <JobRow key={job.id} job={job} onPress={() => navigation.navigate('JobDetail', { jobId: job.id })} />
            ))}
          </View>
        ) : (
          <>
            {pastJobs.length > 0 ? (
              <View style={styles.cardList}>
                {pastJobs.map((job) => {
                  const needsRating = reviewedJobIds ? !reviewedJobIds.has(job.id) : false;
                  return (
                    <JobRow
                      key={job.id}
                      job={job}
                      needsRating={needsRating}
                      onPress={() => navigation.navigate(needsRating ? 'RateCustomer' : 'JobDetail', { jobId: job.id })}
                    />
                  );
                })}
              </View>
            ) : null}
            {lost.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Not picked</Text>
                <View style={styles.cardList}>
                  {lost.map((item) => (
                    <RequestCard key={item.request.id} item={item} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    filtersWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    body: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg, flexGrow: 1 },
    bodyEmpty: { justifyContent: 'center' },
    loading: { alignItems: 'center', paddingVertical: 64 },

    // A receipt-style stat strip, not a bold hero - the job cards carry the
    // visual weight; earnings is a quiet number to glance at, in the app's
    // numeral voice (fonts.mono).
    statsCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: 4,
      ...shadow.card,
    },
    statsLabel: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    statsValue: { fontSize: 22, fontFamily: fonts.mono, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },

    section: { gap: spacing.md },
    sectionTitle: { color: colors.ink, fontSize: 16.5, letterSpacing: -0.3, fontFamily: fonts.bold },
    cardList: { gap: spacing.md },

    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    cardPressed: { opacity: 0.92 },
    cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    cardTitle: { fontSize: 15.5, fontFamily: fonts.bold, color: colors.ink },
    cardMeta: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
    cardBudget: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
    rateNudge: { fontSize: 12, fontFamily: fonts.extrabold, color: colors.ink },
  });
}
