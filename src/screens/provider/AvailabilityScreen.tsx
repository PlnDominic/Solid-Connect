import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useMyAvailability, useSaveWeeklyAvailability, useSetAvailabilityMode } from '../../api/location';
import { isApiConfigured } from '../../lib/api';
import { colors, fonts, radii, spacing } from '../../theme';

const MODES = [
  { id: 'AVAILABLE_NOW' as const, label: 'Available now' },
  { id: 'SCHEDULE' as const, label: 'On schedule' },
  { id: 'UNAVAILABLE' as const, label: 'Unavailable' },
  { id: 'PAUSED' as const, label: 'Paused' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_WEEK = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '08:00',
  endTime: '18:00',
}));

export function AvailabilityScreen({ navigation }: { navigation: any }) {
  const { data, isLoading } = useMyAvailability();
  const setMode = useSetAvailabilityMode();
  const saveWeekly = useSaveWeeklyAvailability();

  const activeDays = useMemo(() => {
    const fromRemote = new Set((data?.weekly ?? []).map((w) => w.day_of_week));
    if (fromRemote.size) return fromRemote;
    return new Set(DEFAULT_WEEK.map((d) => d.dayOfWeek));
  }, [data?.weekly]);

  if (!isApiConfigured()) {
    return (
      <Screen>
        <ScreenHeader title="Availability" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <Text style={styles.note}>Set EXPO_PUBLIC_API_URL and apply migration 0012 to manage availability on the server.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Availability" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>Control whether you appear in customer search and matching right now.</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.active} />
        ) : (
          <>
            <View style={styles.chipsWrap}>
              {MODES.map((m) => {
                const active = (data?.mode ?? 'SCHEDULE') === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMode.mutate(m.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.section}>Weekday hours (Africa/Accra)</Text>
            <View style={styles.chipsWrap}>
              {DAYS.map((label, dayOfWeek) => {
                const on = activeDays.has(dayOfWeek);
                return (
                  <Pressable
                    key={label}
                    onPress={() => {
                      const next = new Set(activeDays);
                      if (on) next.delete(dayOfWeek);
                      else next.add(dayOfWeek);
                      const slots = [...next]
                        .sort()
                        .map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '18:00' }));
                      saveWeekly.mutate(slots);
                    }}
                    style={[styles.day, on && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, on && styles.chipLabelActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {(setMode.isPending || saveWeekly.isPending) && <ActivityIndicator color={colors.active} />}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
  section: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink, marginTop: spacing.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  day: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.active, borderColor: colors.active },
  chipLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
  chipLabelActive: { color: colors.white },
});
