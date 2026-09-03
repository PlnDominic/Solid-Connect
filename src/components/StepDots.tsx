import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

/** Onboarding-style dot progress (small pill, one wide "active" dot). */
export function StepDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === activeIndex ? styles.dotActive : styles.dotInactive,
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
        <View key={i} style={[styles.bar, { backgroundColor: i < step ? colors.orange : colors.hairline }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 20, backgroundColor: colors.ink },
  dotInactive: { width: 6, backgroundColor: colors.hairline },
  barsRow: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 5, borderRadius: 999 },
});
