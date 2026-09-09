import { ChevronRight, Star } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerActiveJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useJobReview } from '../../api/reviews';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function JobsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: job, refetch: refetchJob } = useCustomerActiveJob(profile?.id ?? null);
  const { data: provider } = useProvider(job?.provider_id);
  const { data: review, refetch: refetchReview } = useJobReview(job?.id ?? null);
  const needsRating = !!job && job.status === 'completed' && review === null;
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetchJob(), refetchReview()]);
  });

  return (
    <Screen>
      <ScreenHeader title="Jobs" large />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {job ? (
          <View style={{ padding: spacing.lg }}>
            <Pressable style={styles.card} onPress={() => navigation.navigate(needsRating ? 'RateJob' : 'JobDetail', { jobId: job.id })}>
              <Avatar initials={provider?.initials ?? ''} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.title}>
                  {job.title} · {provider?.full_name}
                </Text>
                <Text style={styles.subtitle}>
                  {needsRating
                    ? 'Completed · tap to rate this job'
                    : job.status === 'completed'
                      ? 'COMPLETED'
                      : job.status === 'awaiting_completion_confirmation'
                        ? 'AWAITING_COMPLETION_CONFIRMATION · confirm'
                        : job.status === 'in_progress'
                          ? 'IN_PROGRESS'
                          : 'Waiting for provider to start'}
                </Text>
              </View>
              {needsRating ? (
                <View style={styles.ratePill}>
                  <Star size={10} strokeWidth={2.4} color={colors.white} fill={colors.white} />
                  <Text style={styles.ratePillText}>Rate</Text>
                </View>
              ) : (
                <ChevronRight size={18} strokeWidth={2} color={colors.inkFaint} />
              )}
            </Pressable>
          </View>
        ) : (
          <EmptyState title="No jobs yet" subtitle="Accept a quote from Requests to start a job." />
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
