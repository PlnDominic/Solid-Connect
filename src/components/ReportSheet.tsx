import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { friendlySafetyError, REPORT_REASONS, useReportUser, type ReportContext, type ReportReason } from '../api/safety';
import { useSessionStore } from '../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../theme';
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
  const { height } = useWindowDimensions();
  const profile = useSessionStore((s) => s.profile);
  const report = useReportUser(profile?.id);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [detailsFocused, setDetailsFocused] = useState(false);

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
    <BottomSheet visible={visible} onClose={onClose} bg={colors.paperDim}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Report {reportedName || 'this person'}
        </Text>
        <Text style={styles.body}>What happened? Reports are private. They are not told you reported them.</Text>
      </View>

      {/* The reasons scroll inside the sheet so the note and buttons stay
          reachable on small phones at the larger text size. */}
      <ScrollView
        style={{ maxHeight: height * 0.5 }}
        contentContainerStyle={styles.reasons}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {REPORT_REASONS.map((r) => {
          const selected = reason === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => setReason(r.key)}
              style={({ pressed }) => [styles.reason, selected && styles.reasonOn, pressed && styles.reasonPressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={styles.reasonText}>
                <Text style={styles.reasonLabel}>{r.label}</Text>
                {r.hint ? <Text style={styles.reasonHint}>{r.hint}</Text> : null}
              </View>
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <TextInput
        value={details}
        onChangeText={setDetails}
        onFocus={() => setDetailsFocused(true)}
        onBlur={() => setDetailsFocused(false)}
        placeholder="Anything else we should know? (optional)"
        placeholderTextColor={colors.inkFaint}
        style={[styles.input, detailsFocused && styles.inputFocused]}
        maxLength={1000}
        multiline
        accessibilityLabel="More details (optional)"
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
    header: { gap: spacing.xs, paddingTop: spacing.xs },
    title: { fontSize: fontSizes.xl, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.3 },
    body: { fontSize: fontSizes.md, lineHeight: 23, fontFamily: fonts.regular, color: colors.inkMuted },

    // Room around the cards so their shadows aren't clipped by the scroller.
    reasons: { gap: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: 2 },
    reason: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.xxxl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: colors.card,
      ...shadow.card,
    },
    reasonOn: { borderColor: colors.active },
    reasonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
    reasonText: { flex: 1, gap: 3 },
    reasonLabel: { fontSize: fontSizes.lg, fontFamily: fonts.semibold, color: colors.ink },
    reasonHint: { fontSize: fontSizes.md, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
    radio: {
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: colors.active },
    radioDot: { width: 12, height: 12, borderRadius: radii.pill, backgroundColor: colors.active },

    input: {
      minHeight: 88,
      borderRadius: radii.xxxl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: colors.card,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      fontSize: fontSizes.md,
      lineHeight: 22,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
      ...shadow.card,
    },
    inputFocused: { borderColor: colors.active },
    row: { flexDirection: 'row', gap: spacing.md },
    half: { flex: 1 },
  });
}
