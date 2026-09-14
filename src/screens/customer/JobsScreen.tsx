import { ChevronRight, Star } from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerJobs } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useCustomerReviewedJobIds } from '../../api/reviews';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { JobStatusBadge } from '../../components/JobStatusBadge';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Job } from '../../types/database';

function JobRow({ job, needsRating, onPress }: { job: Job; needsRating: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: provider } = useProvider(job.provider_id);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.cardTop}>
        <Avatar initials={provider?.initials ?? ''} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {provider?.full_name ?? 'Provider'} · {job.location_label}
          </Text>
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

export function JobsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: jobs = [], isLoading, refetch } = useCustomerJobs(profile?.id ?? null);
  const { data: reviewedJobIds } = useCustomerReviewedJobIds(profile?.id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  const activeJobs = jobs.filter((j) => j.status !== 'completed');
  const historyJobs = jobs.filter((j) => j.status === 'completed');

  return (
    <Screen>
      <ScreenHeader title="Jobs" large />
      <ScrollView
        contentContainerStyle={[styles.body, jobs.length === 0 && styles.bodyEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            subtitle="Accept a quote from Requests to start a job."
            action={{ label: 'Browse providers', onPress: () => navigation.navigate('HomeTab', { screen: 'AllProviders' }) }}
          />
        ) : (
          <>
            {activeJobs.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Active</Text>
                  <Text style={styles.sectionCount}>{activeJobs.length}</Text>
                </View>
                <View style={styles.cardList}>
                  {activeJobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      needsRating={false}
                      onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {historyJobs.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>History</Text>
                  <Text style={styles.sectionCount}>{historyJobs.length}</Text>
                </View>
                <View style={styles.cardList}>
                  {historyJobs.map((job) => {
                    const needsRating = reviewedJobIds ? !reviewedJobIds.has(job.id) : false;
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
    body: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.xl, flexGrow: 1 },
    bodyEmpty: { justifyContent: 'center' },
    loading: { alignItems: 'center', paddingVertical: 64 },

    section: { gap: spacing.md },
    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    sectionTitle: { color: colors.ink, fontSize: 16.5, letterSpacing: -0.3, fontFamily: fonts.bold },
    sectionCount: { color: colors.inkFaint, fontSize: 12, fontFamily: fonts.medium },
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
    ratePillText: { fontSize: 12, fontFamily: fonts.bold, color: colors.white },
  });
}
