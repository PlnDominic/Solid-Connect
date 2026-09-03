import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCustomerActiveJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, shadow } from '../../theme';

export function JobsScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useCustomerActiveJob(profile?.id ?? null);
  const { data: provider } = useProvider(job?.provider_id);

  return (
    <Screen>
      <ScreenHeader title="Jobs" large />
      <ScrollView>
        {job ? (
          <View style={{ padding: 16 }}>
            <Pressable style={styles.card} onPress={() => navigation.navigate('JobDetail', { jobId: job.id })}>
              <Avatar initials={provider?.initials ?? ''} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.title}>
                  {job.title} · {provider?.full_name}
                </Text>
                <Text style={styles.subtitle}>
                  {job.status === 'completed' ? 'Completed' : `Step ${job.step} of 5 · on site`}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
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
    gap: 12,
    alignItems: 'center',
    padding: 14,
    borderRadius: radii.xxl,
    backgroundColor: colors.card,
    ...shadow.card,
  },
  title: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  subtitle: { fontSize: 12, color: colors.textFaint },
  chevron: { fontSize: 18, color: colors.textFaint },
});
