import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useAdvanceJobStep, useJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { getOrCreateThread } from '../../api/chat';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

export function JobDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const jobId: string = route.params.jobId;
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: customer } = useProvider(job?.customer_id);
  const advanceStep = useAdvanceJobStep();

  if (!job) return <Screen edges={['top']} />;

  async function handleMessage() {
    if (!profile || !job) return;
    const thread = await getOrCreateThread({ jobId: job.id, requestId: job.request_id, customerId: job.customer_id, providerId: profile.id });
    navigation.navigate('ChatTab', { screen: 'ChatThread', params: { threadId: thread.id, peerId: job.customer_id } });
  }

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
            <Text style={styles.progressLabel}>Job in progress</Text>
            <Text style={styles.progressStep}>Step {job.step} of 5</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(job.step / 5) * 100}%` }]} />
          </View>
          <Text style={styles.progressNote}>
            Started {formatTime(job.started_at)} · GHS {job.price} fixed price
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="Advance step"
            onPress={() => advanceStep.mutate(job)}
            disabled={job.status === 'completed'}
            loading={advanceStep.isPending}
            style={{ flex: 1, height: 48 }}
          />
          <Button title="Message" variant="outline" onPress={handleMessage} style={{ flex: 1, height: 48 }} />
        </View>
        <Text style={styles.footerNote}>Customer confirms completion and releases payment on their side.</Text>
      </ScrollView>
    </Screen>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.lg },
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
    gap: spacing.sm,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },
  progressStep: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, borderRadius: radii.pill, backgroundColor: colors.paperDim, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.active, borderRadius: radii.pill },
  progressNote: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkMuted },

  footerNote: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, textAlign: 'center' },
});
