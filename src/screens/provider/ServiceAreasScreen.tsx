import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { AREAS } from '../../constants/areas';
import { coordsForArea, saveProviderCoverage, useMyServiceAreas } from '../../api/location';
import { isApiConfigured } from '../../lib/api';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const STORAGE_KEY = 'solid-connect:service-areas';
const RADIUS_OPTIONS_KM = [5, 10, 15, 25] as const;

export function ServiceAreasScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [selected, setSelected] = useState<string[]>(['Achimota', 'Airport Residential']);
  const [radiusKm, setRadiusKm] = useState<number | null>(10);
  const [primaryArea, setPrimaryArea] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: remoteAreas, isLoading } = useMyServiceAreas();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSelected(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!remoteAreas?.length) return;
    const cities = remoteAreas
      .filter((a) => a.type === 'CITY' && a.city_name)
      .map((a) => a.city_name as string);
    if (cities.length) {
      setSelected(cities);
      setPrimaryArea(cities[0]);
    }
    const radius = remoteAreas.find((a) => a.type === 'RADIUS' && a.radius_meters);
    if (radius?.radius_meters) {
      setRadiusKm(Math.round(radius.radius_meters / 1000));
    }
  }, [remoteAreas]);

  const toggle = useCallback((area: string) => {
    setSelected((prev) => {
      const next = prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      if (!primaryArea || !next.includes(primaryArea)) {
        setPrimaryArea(next[0] ?? null);
      }
      return next;
    });
  }, [primaryArea]);

  async function persist() {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
      if (isApiConfigured()) {
        const hub = primaryArea && selected.includes(primaryArea) ? primaryArea : selected[0];
        const coords = hub ? coordsForArea(hub) : null;
        await saveProviderCoverage({
          cityNames: selected,
          radius:
            radiusKm && coords
              ? { lng: coords.lng, lat: coords.lat, radiusMeters: radiusKm * 1000 }
              : null,
        });
      }
      Alert.alert(
        'Saved',
        isApiConfigured()
          ? radiusKm
            ? `Neighborhoods + ${radiusKm} km radius synced.`
            : 'Service areas synced to the server.'
          : 'Saved on this device.',
      );
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Service areas" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>
          Pick Accra neighborhoods you cover. Optionally add a radius from your primary area so customers nearby can find you (Phase C exit: 10 km).
        </Text>
        {isLoading && isApiConfigured() ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <>
            <Text style={styles.section}>Neighborhoods</Text>
            <View style={styles.chipsWrap}>
              {AREAS.map((area) => {
                const active = selected.includes(area);
                const isPrimary = primaryArea === area;
                return (
                  <Pressable
                    key={area}
                    onPress={() => toggle(area)}
                    onLongPress={() => active && setPrimaryArea(area)}
                    style={[styles.chip, active && styles.chipActive, isPrimary && styles.chipPrimary]}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                      {area}
                      {isPrimary ? ' · hub' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>Long-press a selected area to make it the radius hub.</Text>

            <Text style={styles.section}>Service radius from hub</Text>
            <View style={styles.chipsWrap}>
              <Pressable
                onPress={() => setRadiusKm(null)}
                style={[styles.chip, radiusKm == null && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, radiusKm == null && styles.chipLabelActive]}>Cities only</Text>
              </Pressable>
              {RADIUS_OPTIONS_KM.map((km) => {
                const active = radiusKm === km;
                return (
                  <Pressable
                    key={km}
                    onPress={() => setRadiusKm(km)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{km} km</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <Button
          title={saving ? 'Saving…' : 'Save coverage'}
          onPress={persist}
          disabled={saving || selected.length === 0}
          loading={saving}
        />
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
    section: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    hint: { fontSize: 12, fontFamily: fonts.regular, color: colors.inkFaint },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipPrimary: { borderWidth: 2, borderColor: colors.navy },
    chipLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    chipLabelActive: { color: colors.paper },
  });
}
