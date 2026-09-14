import { ChevronLeft, MessageCircle, Receipt, ShieldAlert } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useFinishJob, useJob, useStartJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { getOrCreateThread } from '../../api/chat';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { JobPhaseTracker } from '../../components/JobPhaseTracker';
import { JobQuickActions, type JobQuickAction } from '../../components/JobQuickActions';
import { LiveLocationCard } from '../../components/LiveLocationCard';
import { Screen } from '../../components/Screen';
import { useReportJobLocation } from '../../hooks/useReportJobLocation';
import { jobStatusHint, jobStatusLabel } from '../../lib/jobStatus';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function JobDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const jobId: string = route.params.jobId;
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: customer } = useProvider(job?.customer_id);
  const startJob = useStartJob();
  const finishJob = useFinishJob();
  useReportJobLocation(job);

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

  const quickActions: JobQuickAction[] = [
    { key: 'message', label: 'Message', icon: MessageCircle, onPress: handleMessage },
    ...(job.status === 'completed'
      ? [{ key: 'receipt', label: 'Receipt', icon: Receipt, onPress: () => navigation.navigate('Receipt', { jobId: job.id }) }]
      : []),
    { key: 'dispute', label: 'Dispute', icon: ShieldAlert, onPress: () => navigation.navigate('Dispute', { jobId: job.id }), tone: 'danger' },
  ];

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.navigate('JobsHome')}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
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
            <Text style={styles.progressLabel}>{jobStatusLabel(job.status, 'provider')}</Text>
            <Text style={styles.progressStep}>GHS {job.price.toLocaleString()}</Text>
          </View>
          <JobPhaseTracker status={job.status} />
          <Text style={styles.progressNote}>{jobStatusHint(job.status, 'provider')}</Text>
        </View>

        <LiveLocationCard job={job} viewerRole="provider" />

        <Button
          title={primaryCta.title}
          onPress={primaryCta.onPress}
          loading={primaryCta.loading}
          disabled={primaryCta.disabled}
        />

        <JobQuickActions actions={quickActions} />
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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
    bodyContent: { padding: spacing.lg, gap: spacing.md },

    progressCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressLabel: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: 0.2 },
    progressStep: { fontSize: 13, fontFamily: fonts.bold, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
    progressNote: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.inkMuted },
  });
}
