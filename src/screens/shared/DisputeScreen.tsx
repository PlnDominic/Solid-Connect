import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';
import {
  friendlyDisputeError,
  useAddDisputeEvidence,
  useDisputeEvidence,
  useJobDispute,
  useOpenDispute,
  useRespondToDispute,
  type EvidenceItem,
} from '../../api/disputes';
import { useJob } from '../../api/jobs';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { disputeAccess, disputeTimeline, MAX_EVIDENCE_PER_PARTY } from '../../lib/disputeCase';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Dispute, DisputeReason } from '../../types/database';

const DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;

const REASONS: { id: DisputeReason; label: string }[] = [
  { id: 'not_completed', label: 'Work not completed' },
  { id: 'poor_quality', label: 'Poor quality' },
  { id: 'overcharged', label: 'Overcharged' },
  { id: 'no_show', label: 'Provider no-show' },
  { id: 'other', label: 'Other' },
];

const STEP_LABEL = { filed: 'Filed', response: 'Provider responded', resolved: 'Resolved' } as const;

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Opens the photo library for up to `limit` images; returns their URIs. */
async function pickPhotos(limit: number): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photo access needed', 'Allow photo library access to attach evidence.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 0.7,
  });
  return result.canceled ? [] : result.assets.map((a) => a.uri).slice(0, limit);
}

export function DisputeScreen({ navigation, route }: { navigation: any; route: any }) {
  const jobId: string = route.params.jobId;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: existing } = useJobDispute(jobId);
  const { data: evidence = [] } = useDisputeEvidence(existing?.id);
  const openDispute = useOpenDispute();
  const addEvidence = useAddDisputeEvidence();
  const respond = useRespondToDispute();

  const [reason, setReason] = useState<DisputeReason>('poor_quality');
  const [description, setDescription] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [response, setResponse] = useState('');
  const [responsePhotos, setResponsePhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isCustomer = profile?.role === 'customer';
  // Matches the 48-hour window enforced server-side on the insert policy
  // (0035_retention_dispute_window_feature_flags.sql) - a job that's never
  // been marked complete has no window yet, so only a set completed_at
  // starts the clock.
  const windowExpired = !!job?.completed_at && Date.now() - new Date(job.completed_at).getTime() > DISPUTE_WINDOW_MS;

  async function uploadAndReport(disputeId: string, uris: string[]) {
    if (!profile || !uris.length) return;
    const { failed } = await addEvidence.mutateAsync({ disputeId, authorId: profile.id, imageUris: uris });
    if (failed) {
      Alert.alert(
        'Some photos did not upload',
        `${failed} photo${failed === 1 ? '' : 's'} failed. You can add them again from this page.`,
      );
    }
  }

  async function handleSubmit() {
    if (!profile || !job || profile.role !== 'customer') return;
    setError(null);
    try {
      const dispute = await openDispute.mutateAsync({
        jobId: job.id,
        customerId: profile.id,
        providerId: job.provider_id,
        reason,
        description,
      });
      // The dispute now exists; a photo problem must not undo it.
      await uploadAndReport(dispute.id, photoUris).catch(() => {});
      setPhotoUris([]);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open that dispute. Please try again.');
    }
  }

  async function handleRespond(dispute: Dispute) {
    setError(null);
    try {
      await respond.mutateAsync({ disputeId: dispute.id, response });
      await uploadAndReport(dispute.id, responsePhotos).catch(() => {});
      setResponse('');
      setResponsePhotos([]);
    } catch (e) {
      setError(friendlyDisputeError(e));
    }
  }

  async function handleAddPhotos(dispute: Dispute, left: number) {
    const uris = await pickPhotos(left);
    if (uris.length) await uploadAndReport(dispute.id, uris).catch((e) => Alert.alert('Could not add photos', friendlyDisputeError(e)));
  }

  function renderEvidence(items: EvidenceItem[]) {
    if (!items.length) return null;
    return (
      <View style={styles.photoRow}>
        {items.map((e) => (e.url ? <Image key={e.id} source={{ uri: e.url }} style={styles.photo} /> : <View key={e.id} style={styles.photo} />))}
      </View>
    );
  }

  function renderPicker(uris: string[], setUris: (u: string[]) => void) {
    return (
      <View style={styles.photoRow}>
        {uris.map((uri) => (
          <View key={uri}>
            <Image source={{ uri }} style={styles.photo} />
            <Pressable
              hitSlop={10}
              style={styles.photoRemove}
              onPress={() => setUris(uris.filter((u) => u !== uri))}
              accessibilityRole="button"
              accessibilityLabel="Remove this photo"
            >
              <X size={12} strokeWidth={3} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {uris.length < MAX_EVIDENCE_PER_PARTY ? (
          <Pressable
            style={styles.photoAdd}
            onPress={async () => setUris([...uris, ...(await pickPhotos(MAX_EVIDENCE_PER_PARTY - uris.length))].slice(0, MAX_EVIDENCE_PER_PARTY))}
            accessibilityRole="button"
            accessibilityLabel="Add evidence photos"
          >
            <ImagePlus size={20} strokeWidth={1.8} color={colors.inkFaint} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderCase(d: Dispute) {
    const mine = evidence.filter((e) => e.author_id === profile?.id);
    const access = disputeAccess(d, profile?.id, mine.length);
    const customerEvidence = evidence.filter((e) => e.author_id === d.customer_id);
    const providerEvidence = evidence.filter((e) => e.author_id === d.provider_id);
    const timeline = disputeTimeline(d);
    const reasonLabel = REASONS.find((r) => r.id === d.reason)?.label ?? 'Dispute';

    return (
      <>
        <View style={styles.card}>
          <View style={styles.timeline}>
            {timeline.map((s) => (
              <View key={s.key} style={styles.timelineItem}>
                <View style={[styles.timelineDot, s.done && styles.timelineDotDone]} />
                <Text style={[styles.timelineLabel, s.done && styles.timelineLabelDone]}>{STEP_LABEL[s.key]}</Text>
                {s.at ? <Text style={styles.timelineDate}>{formatWhen(s.at)}</Text> : null}
              </View>
            ))}
          </View>
        </View>

        {d.status === 'open' ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {d.payment_already_released
                ? 'This payment was already released. Our team will follow up with both of you.'
                : 'The payment is on hold until this dispute is resolved.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.statusLabel}>{isCustomer ? 'YOUR DISPUTE' : 'CUSTOMER’S DISPUTE'} · {reasonLabel.toUpperCase()}</Text>
          <Text style={styles.bodyText}>{d.description || reasonLabel}</Text>
          {renderEvidence(customerEvidence)}
        </View>

        {d.provider_response ? (
          <View style={styles.card}>
            <Text style={styles.statusLabel}>{isCustomer ? 'PROVIDER’S RESPONSE' : 'YOUR RESPONSE'}</Text>
            <Text style={styles.bodyText}>{d.provider_response}</Text>
            {renderEvidence(providerEvidence)}
          </View>
        ) : null}

        {access.canRespond ? (
          <View style={styles.card}>
            <Text style={styles.statusLabel}>YOUR SIDE</Text>
            <Text style={styles.bodyText}>You can respond once. Add photos that back you up.</Text>
            <TextInput
              value={response}
              onChangeText={setResponse}
              placeholder="What happened from your side?"
              placeholderTextColor={colors.inkFainter}
              multiline
              maxLength={2000}
              style={styles.textarea}
            />
            {renderPicker(responsePhotos, setResponsePhotos)}
            <Button
              title="Send response"
              onPress={() => handleRespond(d)}
              loading={respond.isPending || addEvidence.isPending}
              disabled={!response.trim()}
            />
          </View>
        ) : null}

        {access.canAddEvidence && !access.canRespond ? (
          <Button
            title={`Add photos (${access.evidenceLeft} left)`}
            variant="outline"
            onPress={() => handleAddPhotos(d, access.evidenceLeft)}
            loading={addEvidence.isPending}
          />
        ) : null}

        {d.status === 'resolved' ? (
          <View style={styles.card}>
            <Text style={styles.statusLabel}>OUTCOME</Text>
            <Text style={styles.bodyText}>{d.resolution_note || 'This dispute was resolved by Solid Connect.'}</Text>
          </View>
        ) : (
          <Text style={styles.note}>Solid Connect ops will review evidence from both sides.</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={existing ? 'Dispute' : 'Open dispute'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {existing ? (
          renderCase(existing)
        ) : !isCustomer ? (
          <Text style={styles.lead}>No dispute has been filed on this job yet.</Text>
        ) : windowExpired ? (
          <View style={styles.card}>
            <Text style={styles.statusLabel}>WINDOW CLOSED</Text>
            <Text style={styles.statusValue}>Too late to dispute this job</Text>
            <Text style={styles.bodyText}>
              Disputes need to be filed within 48 hours of a job being marked complete. If something's still wrong,
              contact support@solidconnect.co directly.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.lead}>
              File a dispute on {job?.title ?? 'this job'}. One dispute per job - use clear details so ops can decide.
            </Text>
            <View style={styles.card}>
              {REASONS.map((r, i) => (
                <Pressable
                  key={r.id}
                  onPress={() => setReason(r.id)}
                  style={[styles.row, i < REASONS.length - 1 && styles.rowBorder]}
                >
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <View style={[styles.radio, reason === r.id && styles.radioActive]}>
                    {reason === r.id ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What happened? Include dates, amounts, and what you expected."
              placeholderTextColor={colors.inkFainter}
              multiline
              style={styles.textarea}
            />
            <View style={styles.card}>
              <Text style={styles.statusLabel}>
                PHOTO EVIDENCE ({photoUris.length}/{MAX_EVIDENCE_PER_PARTY})
              </Text>
              {renderPicker(photoUris, setPhotoUris)}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title="Submit dispute"
              onPress={handleSubmit}
              loading={openDispute.isPending || addEvidence.isPending}
              disabled={!description.trim()}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    lead: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
    card: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      overflow: 'hidden',
      padding: spacing.lg,
      gap: spacing.sm,
    },
    banner: { borderRadius: radii.lg, backgroundColor: colors.pendingBg, padding: spacing.md },
    bannerText: { fontSize: 13, lineHeight: 19, fontFamily: fonts.medium, color: colors.pending },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    radio: {
      width: 20,
      height: 20,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: colors.ink },
    radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.ink },
    textarea: {
      minHeight: 120,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.md,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
    },
    error: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger },
    statusLabel: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    statusValue: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
    bodyText: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
    note: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint, marginTop: 4 },
    timeline: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    timelineItem: { flex: 1, alignItems: 'center', gap: 4 },
    timelineDot: {
      width: 12,
      height: 12,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.paperDim,
    },
    timelineDotDone: { backgroundColor: colors.ink, borderColor: colors.ink },
    timelineLabel: { fontSize: 11.5, fontFamily: fonts.medium, color: colors.inkFaint, textAlign: 'center' },
    timelineLabelDone: { color: colors.ink, fontFamily: fonts.semibold },
    timelineDate: { fontSize: 11, fontFamily: fonts.regular, color: colors.inkFaint },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    photo: { width: 72, height: 72, borderRadius: radii.md, backgroundColor: colors.paperDim },
    photoRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: radii.pill,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoAdd: {
      width: 72,
      height: 72,
      borderRadius: radii.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
