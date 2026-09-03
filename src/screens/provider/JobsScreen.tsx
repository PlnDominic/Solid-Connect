import { ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useProviderJobs } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';
import type { Job } from '../../types/database';

function JobRow({ job, onPress }: { job: Job; onPress: () => void }) {
  const { data: customer } = useProvider(job.customer_id);
  if (!customer) return null;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Avatar initials={customer.initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title}>
          {job.title} · {customer.full_name}
        </Text>
        <Text style={styles.subtitle}>{job.status === 'completed' ? 'Completed' : `Step ${job.step} of 5 · on site`}</Text>
      </View>
      <ChevronRight size={18} strokeWidth={2} color={colors.inkFaint} />
    </Pressable>
  );
}

export function JobsScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: jobs = [] } = useProviderJobs(profile?.id ?? null);

  return (
    <Screen>
      <ScreenHeader title="Jobs" large />
      <ScrollView>
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
});
