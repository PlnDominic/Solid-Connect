import { useState } from 'react';
import { Check, ChevronLeft, MapPin, Star } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
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

  if (!job) return <Screen edges={['top']} />;

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
          <Avatar initials={provider?.initials ?? ''} size={44} dim fg={colors.white} />
          <View style={{ gap: 3 }}>
            <Text style={styles.peerName}>{provider?.full_name}</Text>
            <View style={styles.peerMetaRow}>
              <Star color={colors.white} fill={colors.white} size={11} strokeWidth={2} />
              <Text style={styles.peerMeta}>{provider?.provider_rating.toFixed(1)}</Text>
              <Text style={styles.peerMetaDim}>· {provider?.provider_jobs_count} jobs</Text>
            </View>
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
          <Text style={styles.progressNote}>Provider on site · started {formatTime(job.started_at)}</Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>DETAILS</Text>
          <Text style={styles.detailsValue}>
            {job.title} · GHS {job.price} fixed price
          </Text>
          <View style={styles.detailsLocationRow}>
            <MapPin size={13} strokeWidth={1.8} color={colors.inkFaint} />
            <Text style={styles.detailsSub}>{job.location_label}</Text>
          </View>
        </View>

        <Button title="Message provider" variant="outline" onPress={handleMessage} />
      </ScrollView>

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
            <Check size={22} strokeWidth={3} color={colors.confirm} />
          </View>
          <Text style={styles.sheetTitle}>Payment released</Text>
          <Text style={[styles.sheetBody, { textAlign: 'center' }]}>
            GHS {job.price} sent to {provider?.full_name}. How was the job?
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Star
                  size={30}
                  strokeWidth={1.8}
                  color={n <= rating ? colors.active : colors.hairlineStrong}
                  fill={n <= rating ? colors.active : 'transparent'}
                />
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
  peerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  peerMeta: { color: colors.white, opacity: 0.85, fontSize: 12, fontFamily: fonts.medium, fontVariant: ['tabular-nums'] },
  peerMetaDim: { color: colors.white, opacity: 0.6, fontSize: 12, fontFamily: fonts.medium },

  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, gap: spacing.md },

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

  detailsCard: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, gap: 6 },
  detailsLabel: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
  detailsValue: { fontSize: 14.5, fontFamily: fonts.semibold, color: colors.ink },
  detailsLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailsSub: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkMuted },

  footer: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.hairline },
  sheetTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
  sheetBody: { fontSize: 14, lineHeight: 22, fontFamily: fonts.regular, color: colors.inkMuted },
  successIcon: { width: 48, height: 48, borderRadius: radii.pill, backgroundColor: colors.confirmBg, alignItems: 'center', justifyContent: 'center' },
});
