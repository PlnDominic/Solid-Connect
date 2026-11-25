import { useEffect, useState } from 'react';
import { useTabBarClearance } from '../../navigation/TabBar';
import { ChevronRight, Star } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerJobs } from '../../api/jobs';
import { useMyJobPosts } from '../../api/jobPosts';
import { useProvider } from '../../api/marketplace';
import { useMyActiveRequests, useNotifications } from '../../api/requests';
import { useCustomerReviewedJobIds } from '../../api/reviews';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { JobStatusBadge } from '../../components/JobStatusBadge';
import { JobPostSummary } from '../../components/JobPostSummary';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Job } from '../../types/database';
import { ActiveRequestPanel } from './ActiveRequestPanel';
import { statusBadge } from './MyJobPostsScreen';

type Section = 'active' | 'upcoming' | 'past' | 'posts';

/** A booked job nobody has started on yet, set for later - it goes under
 * Upcoming until the provider sets off (en route) or the time arrives. */
export function isUpcomingJob(job: Job, now = Date.now()): boolean {
  if (job.status !== 'accepted' || !job.scheduled_for || job.en_route_at) return false;
  return new Date(job.scheduled_for).getTime() > now;
}

function isPastJob(job: Job) {
  return job.status === 'completed' || job.status === 'cancelled';
}

function JobRow({ job, onPress, onRate }: { job: Job; onPress: () => void; onRate?: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: provider } = useProvider(job.provider_id);
  const scheduled = isUpcomingJob(job) && job.scheduled_for ? new Date(job.scheduled_for) : null;
  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.cardTop, pressed && styles.cardPressed]}
        onPress={onPress}
        accessibilityRole="button"
      >
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
      </Pressable>
      <View style={styles.cardBottom}>
        <JobStatusBadge status={job.status} role="customer" />
        {onRate ? (
          <Pressable style={styles.ratePill} onPress={onRate} accessibilityRole="button" accessibilityLabel={`Rate ${job.title}`}>
            <Star size={10} strokeWidth={2.4} color={colors.white} fill={colors.white} />
            <Text style={styles.ratePillText}>Rate</Text>
          </Pressable>
        ) : null}
        <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
      </View>
    </View>
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
export function ActivityScreen({ navigation, route }: { navigation: any; route?: any }) {
  const tabClearance = useTabBarClearance();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const userId = profile?.id ?? null;
  const [section, setSection] = useState<Section>('active');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const focusedRequestId: string | undefined = route?.params?.requestId;
  const requestedSection = route?.params?.section;
  const notificationId = route?.params?.notificationId;
  useEffect(() => {
    if (requestedSection === 'posts') {
      setSection('posts');
      navigation.setParams({ section: undefined, requestId: undefined, notificationId: undefined });
    } else if (focusedRequestId) {
      setSection('active');
    }
  }, [focusedRequestId, navigation, notificationId, requestedSection]);

  const { data: requests = [], isLoading: requestLoading, isError: requestsError, refetch: refetchRequest } = useMyActiveRequests(userId);
  const { data: notifications = [], refetch: refetchNotifs } = useNotifications(userId);
  const { data: jobs = [], isLoading: jobsLoading, isError: jobsError, refetch: refetchJobs } = useCustomerJobs(userId);
  const { data: posts = [], isLoading: postsLoading, isError: postsError, refetch: refetchPosts } = useMyJobPosts(userId);
  const { data: reviewedJobIds } = useCustomerReviewedJobIds(userId);
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetchRequest(), refetchNotifs(), refetchJobs(), refetchPosts()]);
  });

  const unreadRejects = notifications.filter((notice) => notice.type === 'DIRECT_REJECTED' && !notice.read_at);
  const hasRequest = requests.length > 0 || unreadRejects.length > 0;
  const upcomingJobs = jobs.filter((j) => isUpcomingJob(j));
  const pastJobs = jobs.filter(isPastJob);
  const activeJobs = jobs.filter((j) => !isPastJob(j) && !isUpcomingJob(j));
  const activeCount = activeJobs.length + requests.length;
  const focusedRequest = requests.find((request) => request.id === focusedRequestId);
  const visibleRequests = focusedRequest ? [focusedRequest, ...requests.filter((request) => request.id !== focusedRequestId)] : requests;
  const linkedJob = focusedRequestId ? jobs.find((job) => job.request_id === focusedRequestId) : undefined;

  // A quote that was declined, revised away or accepted can't stay selected.
  const compareRequest = requests.find((request) => request.quotes.some((quote) => compareIds.includes(quote.id)));
  const liveCompareIds = compareIds.filter((id) => compareRequest?.quotes.some((quote) => quote.id === id));

  function toggleCompare(requestId: string, quoteId: string) {
    if (liveCompareIds.includes(quoteId)) {
      setCompareIds(liveCompareIds.filter((id) => id !== quoteId));
      return;
    }
    if (compareRequest && compareRequest.id !== requestId) {
      setCompareIds([quoteId]);
      return;
    }
    if (liveCompareIds.length >= 3) {
      Alert.alert('Compare up to 3', 'Deselect a quote first to add another.');
      return;
    }
    setCompareIds([...liveCompareIds, quoteId]);
  }

  const sections: FilterOption[] = [
    { id: 'active', label: activeCount ? `Active · ${activeCount}` : 'Active' },
    { id: 'upcoming', label: upcomingJobs.length ? `Upcoming · ${upcomingJobs.length}` : 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'posts', label: 'Public posts' },
  ];

  const loading = section === 'posts' ? postsLoading : jobsLoading || (section === 'active' && requestLoading);
  const isEmpty =
    section === 'posts' ? posts.length === 0 : section === 'active'
      ? !focusedRequestId && !hasRequest && activeCount === 0
      : section === 'upcoming' ? upcomingJobs.length === 0 : pastJobs.length === 0;
  const hasLoadError = section === 'posts' ? postsError : jobsError || (section === 'active' && requestsError);

  function renderJobs(list: Job[], rateable: boolean) {
    return (
      <View style={styles.cardList}>
        {list.map((job) => {
          const needsRating = rateable && job.status === 'completed' && reviewedJobIds && !reviewedJobIds.has(job.id);
          return (
            <JobRow
              key={job.id}
              job={job}
              onRate={needsRating ? () => navigation.navigate('RateJob', { jobId: job.id }) : undefined}
              onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
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
        <FilterChips options={sections} value={section} onChange={(id) => {
          if (focusedRequestId) navigation.setParams({ requestId: undefined, notificationId: undefined });
          setSection(id as Section);
        }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, !loading && isEmpty && styles.bodyEmpty, { paddingBottom: tabClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        {hasLoadError ? (
          <EmptyState title="Could not load all activity" action={{ label: 'Retry', onPress: onRefresh }} />
        ) : null}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : isEmpty && hasLoadError ? null : isEmpty ? (
          section === 'active' ? (
            <EmptyState
              title="Nothing in progress"
              subtitle="Post a job or find a provider on Home."
              action={{ label: 'Post a job', onPress: () => navigation.navigate('HomeTab', { screen: 'PostJob' }) }}
            />
          ) : section === 'upcoming' ? (
            <EmptyState title="Nothing scheduled" subtitle="Jobs booked for a later date show up here." />
          ) : section === 'posts' ? (
            <EmptyState title="No public posts yet" action={{
              label: 'Post a job', onPress: () => navigation.navigate('HomeTab', { screen: 'PostJob' }),
            }} />
          ) : (
            <EmptyState title="No past jobs yet" subtitle="Completed and cancelled jobs show up here." />
          )
        ) : section === 'active' ? (
          <>
            {focusedRequestId && !focusedRequest && !hasLoadError ? (
              <EmptyState
                title={linkedJob ? 'This request became a job' : 'This request is no longer active'}
                action={linkedJob ? { label: 'View job', onPress: () => navigation.navigate('JobDetail', { jobId: linkedJob.id }) } : undefined}
              />
            ) : null}
            {unreadRejects.length > 0 ? (
              <ActiveRequestPanel navigation={navigation} request={null} unreadRejects={unreadRejects} compareIds={[]} />
            ) : null}
            {visibleRequests.map((request) => (
              <ActiveRequestPanel
                key={request.id}
                navigation={navigation}
                request={request}
                compareIds={liveCompareIds}
                onToggleCompare={(quoteId) => toggleCompare(request.id, quoteId)}
              />
            ))}
            {activeJobs.length > 0 ? (
              <View style={styles.section}>
                {hasRequest ? <Text style={styles.sectionTitle}>Jobs under way</Text> : null}
                {renderJobs(activeJobs, false)}
              </View>
            ) : null}
          </>
        ) : section === 'posts' ? (
          posts.map((post) => {
            const badge = statusBadge(post, colors);
            return (
              <Pressable
                key={post.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate('HomeTab', { screen: 'JobPostDetail', params: { postId: post.id } })}
              >
                <JobPostSummary compact post={post} aside={<Badge label={badge.label} bg={badge.bg} fg={badge.fg} />} />
              </Pressable>
            );
          })
        ) : section === 'upcoming' ? (
          renderJobs(upcomingJobs, false)
        ) : (
          renderJobs(pastJobs, true)
        )}
      </ScrollView>
      {section === 'active' && compareRequest && liveCompareIds.length >= 2 ? (
        <View style={styles.compareBar}>
          <Button
            title={`Compare ${liveCompareIds.length} quotes`}
            onPress={() => navigation.navigate('CompareQuotes', { requestId: compareRequest.id, quoteIds: liveCompareIds })}
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
      minHeight: 48,
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
