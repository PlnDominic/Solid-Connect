import { ChevronRight, Star } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerActiveJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useJobReview } from '../../api/reviews';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

export function JobsScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useCustomerActiveJob(profile?.id ?? null);
  const { data: provider } = useProvider(job?.provider_id);
  const { data: review } = useJobReview(job?.id ?? null);
  const needsRating = !!job && job.status === 'completed' && review === null;

  return (
    <Screen>
      <ScreenHeader title="Jobs" large />
      <ScrollView>
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
                      ? 'Completed'
                      : `Step ${job.step} of 5 · on site`}
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

const styles = StyleSheet.create({
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
