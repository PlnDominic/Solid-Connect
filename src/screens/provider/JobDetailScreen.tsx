import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useAdvanceJobStep, useJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { getOrCreateThread } from '../../api/chat';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii } from '../../theme';

export function JobDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const jobId: string = route.params.jobId;
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: customer } = useProvider(job?.customer_id);
  const advanceStep = useAdvanceJobStep();

  if (!job) return <Screen dark />;

  async function handleMessage() {
    if (!profile || !job) return;
    const thread = await getOrCreateThread({ jobId: job.id, requestId: job.request_id, customerId: job.customer_id, providerId: profile.id });
    navigation.navigate('ChatTab', { screen: 'ChatThread', params: { threadId: thread.id, peerId: job.customer_id } });
  }

  return (
    <Screen dark edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.navigate('JobsHome')} hitSlop={12}>
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{job.title}</Text>
        </View>
        <View style={styles.peerRow}>
          <Avatar initials={customer?.initials ?? ''} size={40} dim />
          <View style={{ gap: 2 }}>
            <Text style={styles.peerName}>{customer?.full_name}</Text>
            <Text style={styles.peerMeta}>{customer?.area}</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Job in progress</Text>
            <Text style={styles.progressLabel}>Step {job.step} of 5</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(job.step / 5) * 100}%` }]} />
          </View>
          <Text style={styles.progressNote}>
            Started {formatTime(job.started_at)} · GHS {job.price} fixed price
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
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
      </View>
    </Screen>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chevron: { color: colors.white, fontSize: 20 },
  headerTitle: { color: colors.white, fontSize: 18, fontFamily: fonts.bold },
  peerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  peerName: { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
  peerMeta: { color: colors.white, opacity: 0.7, fontSize: 12 },
  body: { flex: 1, backgroundColor: colors.surface, padding: 16, gap: 16 },
  progressCard: { borderRadius: radii.xxl, backgroundColor: colors.tile, padding: 16, gap: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.black },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: colors.tileBorder, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.orange, borderRadius: 999 },
  progressNote: { fontSize: 13, color: '#08080A' },
  footerNote: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
});
