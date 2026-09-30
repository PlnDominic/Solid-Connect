import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useProviderOpenSlots } from '../api/booking';
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Lets a customer choose one of a provider's real open slots (see
 * useProviderOpenSlots). `value` is the chosen slot's ISO start, or null for
 * "agree a time later" - picking a time is optional, never a blocker.
 */
export function SlotPicker({
  providerId,
  value,
  onChange,
  label = 'When do you need them?',
  optionalHint = 'Optional - or agree a time with the provider later.',
}: {
  providerId: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  label?: string;
  optionalHint?: string;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: slots = [], isLoading, isError } = useProviderOpenSlots(providerId);

  // Group slots by the customer's own local calendar day.
  const days = useMemo(() => {
    const map = new Map<string, { date: Date; slots: string[] }>();
    for (const iso of slots) {
      const d = new Date(iso);
      const key = dayKey(d);
      if (!map.has(key)) map.set(key, { date: d, slots: [] });
      map.get(key)!.slots.push(iso);
    }
    return [...map.values()];
  }, [slots]);

  const [dayIdx, setDayIdx] = useState(0);
  const day = days[Math.min(dayIdx, Math.max(days.length - 1, 0))];

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={colors.inkFaint} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      {isError || days.length === 0 ? (
        <Text style={styles.hint}>
          {isError ? 'Could not load availability.' : 'No open times in the next two weeks.'} You can still go ahead and agree a
          time in chat.
        </Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {days.map((d, i) => {
              const selected = i === dayIdx;
              return (
                <Pressable
                  key={dayKey(d.date)}
                  onPress={() => setDayIdx(i)}
                  style={[styles.dayChip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.dayName, selected && styles.chipTextSelected]}>
                    {d.date.toLocaleDateString([], { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNum, selected && styles.chipTextSelected]}>{d.date.getDate()}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.slotRow}>
            {day?.slots.map((iso) => {
              const selected = value === iso;
              return (
                <Pressable
                  key={iso}
                  onPress={() => onChange(selected ? null : iso)}
                  style={[styles.slotChip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.slotText, selected && styles.chipTextSelected]}>
                    {new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {value ? 'Tap the time again to leave it open.' : optionalHint}
          </Text>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    label: { color: colors.ink, fontSize: 13, fontFamily: fonts.semibold },
    hint: { color: colors.inkFaint, fontSize: 12, fontFamily: fonts.medium, lineHeight: 17 },
    chips: { gap: spacing.sm, paddingVertical: 2 },
    dayChip: {
      width: 52,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.paperDim,
    },
    dayName: { color: colors.inkFaint, fontSize: 11, fontFamily: fonts.semibold },
    dayNum: { color: colors.ink, fontSize: 16, fontFamily: fonts.bold },
    slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    slotChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.paperDim,
    },
    slotText: { color: colors.ink, fontSize: 13, fontFamily: fonts.semibold },
    chipSelected: { backgroundColor: colors.active, borderColor: colors.active },
    chipTextSelected: { color: colors.white },
  });
}
