import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useConfirmCompletion, useJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useSubmitReview } from '../../api/jobs';
import { getOrCreateThread } from '../../api/chat';
import { Avatar } from '../../components/Avatar';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

export function JobDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const jobId: string = route.params.jobId;
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: provider } = useProvider(job?.provider_id);
  const confirmCompletion = useConfirmCompletion();
  const submitReview = useSubmitReview();

  const [showPayment, setShowPayment] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);

  if (!job) return <Screen dark />;

  async function handleConfirm() {
    if (!job) return;
    await confirmCompletion.mutateAsync(job);
    setShowPayment(false);
    setShowRating(true);
  }

  async function handleFinishRating() {
    if (!job || !profile) return;
    if (rating > 0) {
      await submitReview.mutateAsync({ jobId: job.id, providerId: job.provider_id, customerId: profile.id, rating });
    }
    setShowRating(false);
    navigation.navigate('JobsHome');
  }

  async function handleMessage() {
    if (!profile || !job) return;
    const thread = await getOrCreateThread({ jobId: job.id, requestId: job.request_id, customerId: profile.id, providerId: job.provider_id });
    navigation.navigate('ChatTab', { screen: 'ChatThread', params: { threadId: thread.id, peerId: job.provider_id } });
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
          <Avatar initials={provider?.initials ?? ''} size={40} dim />
          <View style={{ gap: 2 }}>
            <Text style={styles.peerName}>{provider?.full_name}</Text>
            <Text style={styles.peerMeta}>
              {provider?.provider_rating.toFixed(1)} ★ · {provider?.provider_jobs_count} jobs
            </Text>
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
          <Text style={styles.progressNote}>Provider on site · started {formatTime(job.started_at)}</Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>Details</Text>
          <Text style={styles.detailsValue}>
            {job.title} · GHS {job.price} fixed price
          </Text>
          <Text style={styles.detailsSub}>{job.location_label}</Text>
        </View>

        <Button title="Message provider" variant="outline" onPress={handleMessage} />
      </View>

      <View style={styles.footer}>
        <Button title="Confirm completion" onPress={() => setShowPayment(true)} disabled={job.status === 'completed'} />
      </View>

      <BottomSheet visible={showPayment} onClose={() => setShowPayment(false)}>
        <Text style={styles.sheetTitle}>Confirm job completion</Text>
        <Text style={styles.sheetBody}>
          Releasing payment tells us the work is done. You can still open a dispute for 48 hours.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Not yet" variant="outline" onPress={() => setShowPayment(false)} style={{ flex: 1, height: 48 }} />
          <Button title="Confirm" onPress={handleConfirm} loading={confirmCompletion.isPending} style={{ flex: 1, height: 48 }} />
        </View>
      </BottomSheet>

      <BottomSheet visible={showRating}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <View style={styles.successIcon}>
            <Text style={{ color: colors.successStrong, fontSize: 22, fontFamily: fonts.extrabold }}>✓</Text>
          </View>
          <Text style={styles.sheetTitle}>Payment released</Text>
          <Text style={[styles.sheetBody, { textAlign: 'center' }]}>
            GHS {job.price} sent to {provider?.full_name}. How was the job?
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Text style={{ fontSize: 30, color: n <= rating ? colors.orange : colors.inputBorder }}>★</Text>
              </Pressable>
            ))}
          </View>
          <Button title="Done" onPress={handleFinishRating} loading={submitReview.isPending} style={{ width: '100%' }} />
        </View>
      </BottomSheet>
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
  detailsCard: { borderRadius: radii.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, padding: 14, gap: 6 },
  detailsLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  detailsValue: { fontSize: 14, color: colors.textHeading },
  detailsSub: { fontSize: 13, color: colors.textFaint },
  footer: { padding: 16, paddingBottom: 24, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.hairline },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
  sheetBody: { fontSize: 14, lineHeight: 22, color: colors.textMuted },
  successIcon: { width: 44, height: 44, borderRadius: 999, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
});
