import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radii } from '../../theme';

const STORAGE_KEY = 'solid-connect:service-areas';

const AREAS = [
  'East Legon',
  'Trasacco Valley',
  'Airport Residential',
  'Cantonments',
  'Osu',
  'Spintex',
  'Tema',
  'Dansoman',
];

export function ServiceAreasScreen({ navigation }: { navigation: any }) {
  const [selected, setSelected] = useState<string[]>(['East Legon', 'Airport Residential']);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSelected(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  function toggle(area: string) {
    setSelected((prev) => {
      const next = prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <Screen>
      <ScreenHeader title="Service areas" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>Pick the Accra neighborhoods where you're available to take jobs.</Text>
        <View style={styles.chipsWrap}>
          {AREAS.map((area) => {
            const active = selected.includes(area);
            return (
              <Pressable key={area} onPress={() => toggle(area)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{area}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 18 },
  note: { fontSize: 13, color: colors.textFaint, lineHeight: 19 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textHeading },
  chipLabelActive: { color: colors.white },
});
