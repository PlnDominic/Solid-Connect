import { Text, View, StyleSheet } from 'react-native';
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import type { JobStatus } from '../types/database';

/** The 3-stop "Start → Finish → Confirmed" dot tracker - originally
 * provider-only, now shared so a customer's Job Detail shows the same
 * determinate progress a provider already sees, instead of just a status
 * sentence (loading.md/feedback.md: prefer showing real progress over
 * describing it in prose alone). */
export function JobPhaseTracker({ status, tint }: { status: JobStatus; tint?: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const tintColor = tint ?? colors.ink;
  const phases = [
    { label: 'Start', active: true, done: status !== 'accepted' },
    {
      label: 'Finish',
      active: status === 'in_progress' || status === 'awaiting_completion_confirmation' || status === 'completed',
      done: status === 'awaiting_completion_confirmation' || status === 'completed',
    },
    { label: 'Confirmed', active: status === 'completed', done: status === 'completed' },
  ];
  return (
    <View style={styles.phases}>
      {phases.map((phase) => (
        <View key={phase.label} style={styles.phaseItem}>
          <View
            style={[
              styles.phaseDot,
              phase.active && { borderColor: tintColor, backgroundColor: colors.paper },
              phase.done && { backgroundColor: tintColor, borderColor: tintColor },
            ]}
          />
          <Text style={[styles.phaseLabel, phase.active && { color: tintColor, fontFamily: fonts.semibold }]}>{phase.label}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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
    phaseLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
