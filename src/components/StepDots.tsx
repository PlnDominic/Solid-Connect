import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme';

/**
 * Onboarding progress: small ruled ticks, not soft pill dots - the active
 * step reads as a checked/stamped line, matching the receipt/ledger world
 * rather than a generic carousel indicator.
 */
export function StepDots({
  count,
  activeIndex,
  dark = false,
}: {
  count: number;
  activeIndex: number;
  dark?: boolean;
}) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.tick,
            i === activeIndex
              ? [styles.tickActive, dark && styles.tickActiveDark]
              : [styles.tickInactive, dark && styles.tickInactiveDark],
          ]}
        />
      ))}
    </View>
  );
}

/** New-request wizard style progress (N equal bars, filled up to step). */
export function StepBars({ count, step }: { count: number; step: number }) {
  return (
    <View style={styles.barsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.bar, { backgroundColor: i < step ? colors.ink : colors.hairline }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tick: { height: 4, borderRadius: radii.sm, borderWidth: 1 },
  tickActive: { width: 22, backgroundColor: colors.ink, borderColor: colors.ink },
  tickActiveDark: { backgroundColor: colors.white, borderColor: colors.white },
  tickInactive: { width: 4, backgroundColor: 'transparent', borderColor: colors.hairlineStrong },
  tickInactiveDark: { borderColor: 'rgba(255,255,255,0.4)' },
  barsRow: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 999 },
});
