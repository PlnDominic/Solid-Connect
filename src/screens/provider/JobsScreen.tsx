import { ChevronRight } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderJobs } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Job } from '../../types/database';

function JobRow({ job, onPress }: { job: Job; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: customer } = useProvider(job.customer_id);
  const name = customer?.full_name ?? 'Customer';
  const initials = customer?.initials ?? 'CU';
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Avatar initials={initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title}>
          {job.title} · {name}
        </Text>
        <Text style={styles.subtitle}>
          {job.status === 'completed'
            ? 'COMPLETED'
            : job.status === 'awaiting_completion_confirmation'
              ? 'AWAITING_COMPLETION_CONFIRMATION'
              : job.status === 'in_progress'
                ? 'IN_PROGRESS'
                : 'Ready to start'}
        </Text>
      </View>
      <ChevronRight size={18} strokeWidth={2} color={colors.inkFaint} />
    </Pressable>
  );
}

export function JobsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: jobs = [], refetch } = useProviderJobs(profile?.id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  return (
    <Screen>
      <ScreenHeader title="Jobs" large />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {jobs.length ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} onPress={() => navigation.navigate('JobDetail', { jobId: job.id })} />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No jobs yet"
            subtitle="Send a quote from Feed - jobs show up here once a customer accepts it."
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    title: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    subtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
