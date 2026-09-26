import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { friendlySafetyError, REPORT_REASONS, useReportUser, type ReportContext, type ReportReason } from '../api/safety';
import { useSessionStore } from '../store/useSessionStore';
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

/** One reporting sheet for every place a person can be reported from
 * (chat, provider profile, job). The admin panel's Reports queue reads
 * what this writes. */
export function ReportSheet({
  visible,
  onClose,
  reportedId,
  reportedName,
  context,
  jobId,
  threadId,
}: {
  visible: boolean;
  onClose: () => void;
  reportedId: string;
  reportedName?: string | null;
  context: ReportContext;
  jobId?: string | null;
  threadId?: string | null;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const report = useReportUser(profile?.id);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  async function submit() {
    if (!reason) return;
    try {
      await report.mutateAsync({ reportedId, reason, context, details, jobId, threadId });
      setReason(null);
      setDetails('');
      onClose();
      Alert.alert('Report sent', 'Thank you. Our team will review it. You can also block this person.');
    } catch (err) {
      Alert.alert('Could not send report', friendlySafetyError(err));
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Report {reportedName || 'this person'}</Text>
      <Text style={styles.body}>What happened? Reports are private. They are not told you reported them.</Text>
      {REPORT_REASONS.map((r) => (
        <Pressable
          key={r.key}
          onPress={() => setReason(r.key)}
          style={[styles.reason, reason === r.key && styles.reasonOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: reason === r.key }}
        >
          <Text style={styles.reasonLabel}>{r.label}</Text>
          {r.hint ? <Text style={styles.reasonHint}>{r.hint}</Text> : null}
        </Pressable>
      ))}
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="Anything else we should know? (optional)"
        placeholderTextColor={colors.inkFaint}
        style={styles.input}
        maxLength={1000}
        multiline
      />
      <View style={styles.row}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.half} />
        <Button title="Send report" onPress={submit} disabled={!reason} loading={report.isPending} style={styles.half} />
      </View>
    </BottomSheet>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    title: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
    body: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
    reason: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline, padding: spacing.md, gap: 2 },
    reasonOn: { borderColor: colors.ink, backgroundColor: colors.pendingBg },
    reasonLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    reasonHint: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.inkMuted },
    input: {
      minHeight: 56,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      padding: spacing.md,
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
    },
    row: { flexDirection: 'row', gap: 10 },
    half: { flex: 1, height: 46 },
  });
}
