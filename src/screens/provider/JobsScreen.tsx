import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderEarningsThisMonth, useProviderJobs } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
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

function JobRow({ job, onPress }: { job: Job; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: customer } = useProvider(job.customer_id);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.cardTop}>
        <Avatar initials={customer?.initials ?? 'CU'} />
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
      <View style={styles.cardBottom}>
        <JobStatusBadge status={job.status} role="provider" />
        <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
      </View>
    </Pressable>
  );
}

export function JobsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: jobs = [], isLoading: jobsLoading, refetch } = useProviderJobs(profile?.id ?? null);
  const { data: earnings } = useProviderEarningsThisMonth(profile?.id ?? null);
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
        {jobsLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            subtitle="Send a quote from Feed - jobs show up here once a customer accepts it."
            action={{ label: 'Go to Feed', onPress: () => navigation.navigate('FeedTab', { screen: 'Feed' }) }}
          />
        ) : (
          <>
            {earnings != null && earnings > 0 ? (
              <View style={styles.statsCard}>
                <Text style={styles.statsLabel}>EARNED THIS MONTH</Text>
                <Text style={styles.statsValue}>GHS {earnings.toLocaleString()}</Text>
              </View>
            ) : null}

            {activeJobs.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Active</Text>
                  <Text style={styles.sectionCount}>{activeJobs.length}</Text>
                </View>
                <View style={styles.cardList}>
                  {activeJobs.map((job) => (
                    <JobRow key={job.id} job={job} onPress={() => navigation.navigate('JobDetail', { jobId: job.id })} />
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
                  {historyJobs.map((job) => (
                    <JobRow key={job.id} job={job} onPress={() => navigation.navigate('JobDetail', { jobId: job.id })} />
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
    body: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.xl, flexGrow: 1 },
    bodyEmpty: { justifyContent: 'center' },
    loading: { alignItems: 'center', paddingVertical: 64 },

    // A receipt-style stat strip, not a bold hero - this screen's own job
    // cards already carry the visual weight; earnings is a quiet number to
    // glance at, in the app's numeral voice (fonts.mono).
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
  });
}
