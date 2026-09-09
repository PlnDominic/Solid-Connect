import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useOpenDispute, useJobDispute } from '../../api/disputes';
import { useJob } from '../../api/jobs';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { DisputeReason } from '../../types/database';

const REASONS: { id: DisputeReason; label: string }[] = [
  { id: 'not_completed', label: 'Work not completed' },
  { id: 'poor_quality', label: 'Poor quality' },
  { id: 'overcharged', label: 'Overcharged' },
  { id: 'no_show', label: 'Provider no-show' },
  { id: 'other', label: 'Other' },
];

export function DisputeScreen({ navigation, route }: { navigation: any; route: any }) {
  const jobId: string = route.params.jobId;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: existing } = useJobDispute(jobId);
  const openDispute = useOpenDispute();
  const [reason, setReason] = useState<DisputeReason>('poor_quality');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!profile || !job || profile.role !== 'customer') return;
    setError(null);
    try {
      await openDispute.mutateAsync({
        jobId: job.id,
        customerId: profile.id,
        providerId: job.provider_id,
        reason,
        description,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Could not open that dispute. Please try again.');
    }
  }

  const isCustomer = profile?.role === 'customer';

  return (
    <Screen>
      <ScreenHeader title="Open dispute" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {existing ? (
          <View style={styles.card}>
            <Text style={styles.statusLabel}>STATUS</Text>
            <Text style={styles.statusValue}>{existing.status === 'open' ? 'Under review' : 'Resolved'}</Text>
            <Text style={styles.bodyText}>{existing.description || REASONS.find((r) => r.id === existing.reason)?.label}</Text>
            {existing.resolution_note ? (
              <Text style={styles.note}>Resolution: {existing.resolution_note}</Text>
            ) : (
              <Text style={styles.note}>Solid Connect ops will review evidence from both sides.</Text>
            )}
          </View>
        ) : !isCustomer ? (
          <Text style={styles.lead}>No dispute has been filed on this job yet.</Text>
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
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title="Submit dispute"
              onPress={handleSubmit}
              loading={openDispute.isPending}
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
  });
}
