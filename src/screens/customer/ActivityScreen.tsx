import { useState } from 'react';
import { ChevronRight, Star } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerJobs } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useMyActiveRequest, useNotifications } from '../../api/requests';
import { useCustomerReviewedJobIds } from '../../api/reviews';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { JobStatusBadge } from '../../components/JobStatusBadge';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Job } from '../../types/database';
import { ActiveRequestPanel, activeRequestHasContent } from './ActiveRequestPanel';

type Section = 'active' | 'upcoming' | 'past';

/** A booked job nobody has started on yet, set for later - it goes under
 * Upcoming until the provider sets off (en route) or the time arrives. */
export function isUpcomingJob(job: Job, now = Date.now()): boolean {
  if (job.status !== 'accepted' || !job.scheduled_for || job.en_route_at) return false;
  return new Date(job.scheduled_for).getTime() > now;
}

function isPastJob(job: Job) {
  return job.status === 'completed' || job.status === 'cancelled';
}

function JobRow({ job, needsRating, onPress }: { job: Job; needsRating: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: provider } = useProvider(job.provider_id);
  const scheduled = isUpcomingJob(job) && job.scheduled_for ? new Date(job.scheduled_for) : null;
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.cardTop}>
        <Avatar initials={provider?.initials ?? ''} photoUrl={provider?.photo_url} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {provider?.full_name ?? 'Provider'} · {job.location_label}
          </Text>
          {scheduled ? (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {scheduled.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })},{' '}
              {scheduled.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
          ) : null}
        </View>
        <Text style={styles.cardBudget}>GHS {job.price.toLocaleString()}</Text>
      </View>
      <View style={styles.cardBottom}>
        <JobStatusBadge status={job.status} role="customer" />
        {needsRating ? (
          <View style={styles.ratePill}>
            <Star size={10} strokeWidth={2.4} color={colors.white} fill={colors.white} />
            <Text style={styles.ratePillText}>Rate</Text>
          </View>
        ) : (
          <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
        )}
      </View>
    </Pressable>
  );
}

/**
 * The customer's Activity tab: what used to be two tabs (Requests and
 * Jobs) as one timeline, since a request simply becomes a job once a quote
 * is accepted.
 * - Active: the live request and its quotes, plus jobs under way
 * - Upcoming: booked jobs scheduled for later
 * - Past: completed and cancelled jobs, with "Rate" where still owed
 */
export function ActivityScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const userId = profile?.id ?? null;
  const [section, setSection] = useState<Section>('active');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const { data: request, isLoading: requestLoading, refetch: refetchRequest } = useMyActiveRequest(userId);
  const { data: notifications = [], refetch: refetchNotifs } = useNotifications(userId);
  const { data: jobs = [], isLoading: jobsLoading, refetch: refetchJobs } = useCustomerJobs(userId);
  const { data: reviewedJobIds } = useCustomerReviewedJobIds(userId);
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetchRequest(), refetchNotifs(), refetchJobs()]);
  });

  const hasRequest = activeRequestHasContent(request ?? null, notifications);
  const upcomingJobs = jobs.filter((j) => isUpcomingJob(j));
  const pastJobs = jobs.filter(isPastJob);
  const activeJobs = jobs.filter((j) => !isPastJob(j) && !isUpcomingJob(j));
  const activeCount = activeJobs.length + (hasRequest ? 1 : 0);

  // A quote that was declined, revised away or accepted can't stay selected.
  const liveCompareIds = compareIds.filter((id) => request?.quotes.some((q) => q.id === id));

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        Alert.alert('Compare up to 3', 'Deselect a quote first to add another.');
        return prev;
      }
      return [...prev, id];
    });
  }

  const sections: FilterOption[] = [
    { id: 'active', label: activeCount ? `Active · ${activeCount}` : 'Active' },
    { id: 'upcoming', label: upcomingJobs.length ? `Upcoming · ${upcomingJobs.length}` : 'Upcoming' },
    { id: 'past', label: 'Past' },
  ];

  const loading = requestLoading || jobsLoading;
  const isEmpty =
    section === 'active' ? activeCount === 0 : section === 'upcoming' ? upcomingJobs.length === 0 : pastJobs.length === 0;

  function renderJobs(list: Job[], rateable: boolean) {
    return (
      <View style={styles.cardList}>
        {list.map((job) => {
          const needsRating = rateable && reviewedJobIds ? !reviewedJobIds.has(job.id) : false;
          return (
            <JobRow
              key={job.id}
              job={job}
              needsRating={needsRating}
              onPress={() => navigation.navigate(needsRating ? 'RateJob' : 'JobDetail', { jobId: job.id })}
            />
          );
        })}
      </View>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Activity" large />
      <View style={styles.filtersWrap}>
        <FilterChips options={sections} value={section} onChange={(id) => setSection(id as Section)} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, !loading && isEmpty && styles.bodyEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : isEmpty ? (
          section === 'active' ? (
            <EmptyState
              title="Nothing in progress"
              subtitle="Post a request from Home, or find a pro on the Map and send them a direct request."
              action={{ label: 'Post a request', onPress: () => navigation.navigate('HomeTab', { screen: 'Home' }) }}
            />
          ) : section === 'upcoming' ? (
            <EmptyState title="Nothing scheduled" subtitle="Jobs booked for a later date show up here." />
          ) : (
            <EmptyState title="No past jobs yet" subtitle="Completed and cancelled jobs show up here." />
          )
        ) : section === 'active' ? (
          <>
            <ActiveRequestPanel navigation={navigation} compareIds={liveCompareIds} onToggleCompare={toggleCompare} />
            {activeJobs.length > 0 ? (
              <View style={styles.section}>
                {hasRequest ? <Text style={styles.sectionTitle}>Jobs under way</Text> : null}
                {renderJobs(activeJobs, false)}
              </View>
            ) : null}
          </>
        ) : section === 'upcoming' ? (
          renderJobs(upcomingJobs, false)
        ) : (
          renderJobs(pastJobs, true)
        )}
      </ScrollView>
      {section === 'active' && liveCompareIds.length >= 2 ? (
        <View style={styles.compareBar}>
          <Button
            title={`Compare ${liveCompareIds.length} quotes`}
            onPress={() => navigation.navigate('CompareQuotes', { quoteIds: liveCompareIds })}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    filtersWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    body: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg, flexGrow: 1 },
    bodyEmpty: { justifyContent: 'center' },
    loading: { alignItems: 'center', paddingVertical: 64 },

    section: { gap: spacing.md },
    sectionTitle: { color: colors.ink, fontSize: fontSizes.md, letterSpacing: -0.3, fontFamily: fonts.bold },
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
    cardTitle: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    cardMeta: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    cardBudget: { fontSize: fontSizes.md, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    ratePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radii.pill,
      backgroundColor: colors.ink,
    },
    ratePillText: { fontSize: fontSizes.xs, fontFamily: fonts.bold, color: colors.white },

    compareBar: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
    },
  });
}
