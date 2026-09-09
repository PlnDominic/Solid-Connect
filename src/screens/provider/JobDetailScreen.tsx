import { ChevronLeft } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useFinishJob, useJob, useStartJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { getOrCreateThread } from '../../api/chat';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';
import type { JobStatus } from '../../types/database';

function statusLabel(status: JobStatus | string) {
  switch (status) {
    case 'accepted':
      return 'Ready to start';
    case 'in_progress':
      return 'IN_PROGRESS';
    case 'awaiting_completion_confirmation':
      return 'AWAITING_COMPLETION_CONFIRMATION';
    case 'completed':
      return 'COMPLETED';
    default:
      return status;
  }
}

function statusHint(status: JobStatus | string) {
  switch (status) {
    case 'accepted':
      return 'Tap Start work when you begin on site.';
    case 'in_progress':
      return 'When you finish, mark the job complete for the customer to confirm.';
    case 'awaiting_completion_confirmation':
      return 'Waiting for the customer to confirm completion and release payment.';
    case 'completed':
      return 'Job completed. Payment released.';
    default:
      return '';
  }
}

export function JobDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const jobId: string = route.params.jobId;
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: customer } = useProvider(job?.customer_id);
  const startJob = useStartJob();
  const finishJob = useFinishJob();

  if (!job) return <Screen edges={['top']} />;

  async function handleMessage() {
    if (!profile || !job) return;
    const thread = await getOrCreateThread({
      jobId: job.id,
      requestId: job.request_id,
      customerId: job.customer_id,
      providerId: profile.id,
      asRole: 'provider',
    });
    navigation.navigate('ChatTab', {
      screen: 'ChatThread',
      params: { threadId: thread.id, peerId: job.customer_id },
    });
  }

  async function handleStart() {
    try {
      await startJob.mutateAsync(job!);
    } catch (e: any) {
      Alert.alert('Could not start', e?.message ?? 'Try again.');
    }
  }

  async function handleFinish() {
    try {
      await finishJob.mutateAsync(job!);
    } catch (e: any) {
      Alert.alert('Could not finish', e?.message ?? 'Try again.');
    }
  }

  const primaryCta =
    job.status === 'accepted'
      ? {
          title: 'Start work',
          onPress: handleStart,
          loading: startJob.isPending,
          disabled: false,
        }
      : job.status === 'in_progress'
        ? {
            title: 'Mark finished',
            onPress: handleFinish,
            loading: finishJob.isPending,
            disabled: false,
          }
        : job.status === 'awaiting_completion_confirmation'
          ? {
              title: 'Waiting for customer',
              onPress: () => {},
              loading: false,
              disabled: true,
            }
          : {
              title: 'Completed',
              onPress: () => {},
              loading: false,
              disabled: true,
            };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.navigate('JobsHome')} hitSlop={12} style={styles.back}>
            <ChevronLeft size={20} strokeWidth={2.4} color={colors.white} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {job.title}
          </Text>
        </View>
        <View style={styles.peerRow}>
          <Avatar initials={customer?.initials ?? ''} size={44} dim fg={colors.white} />
          <View style={{ gap: 2 }}>
            <Text style={styles.peerName}>{customer?.full_name}</Text>
            <Text style={styles.peerMeta}>{customer?.area}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{statusLabel(job.status)}</Text>
            <Text style={styles.progressStep}>GHS {job.price}</Text>
          </View>
          <View style={styles.phases}>
            <Phase active={true} done={job.status !== 'accepted'} label="Start" />
            <Phase
              active={job.status === 'in_progress' || job.status === 'awaiting_completion_confirmation' || job.status === 'completed'}
              done={job.status === 'awaiting_completion_confirmation' || job.status === 'completed'}
              label="Finish"
            />
            <Phase active={job.status === 'completed'} done={job.status === 'completed'} label="Confirmed" />
          </View>
          <Text style={styles.progressNote}>{statusHint(job.status)}</Text>
        </View>

        <Button
          title={primaryCta.title}
          onPress={primaryCta.onPress}
          loading={primaryCta.loading}
          disabled={primaryCta.disabled}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Message" variant="outline" onPress={handleMessage} style={{ flex: 1, height: 48 }} />
          <Button
            title="Dispute"
            variant="outline"
            onPress={() => navigation.navigate('Dispute', { jobId: job.id })}
            style={{ flex: 1, height: 48 }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Phase({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <View style={styles.phaseItem}>
      <View
        style={[
          styles.phaseDot,
          active && styles.phaseDotActive,
          done && styles.phaseDotDone,
        ]}
      />
      <Text style={[styles.phaseLabel, active && styles.phaseLabelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerTitle: { flex: 1, color: colors.white, fontSize: 18, fontFamily: fonts.bold, letterSpacing: -0.3 },
  peerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  peerName: { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
  peerMeta: { color: colors.white, opacity: 0.7, fontSize: 12, fontFamily: fonts.medium },

  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, gap: spacing.lg },

  progressCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: 0.2 },
  progressStep: { fontSize: 13, fontFamily: fonts.bold, color: colors.inkMuted },
  phases: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  phaseItem: { flex: 1, alignItems: 'center', gap: 6 },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.paperDim,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  phaseDotActive: { borderColor: colors.ink, backgroundColor: colors.paper },
  phaseDotDone: { backgroundColor: colors.ink, borderColor: colors.ink },
  phaseLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.inkFaint },
  phaseLabelActive: { color: colors.ink, fontFamily: fonts.semibold },
  progressNote: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.inkMuted },
});
