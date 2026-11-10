import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Search, X } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { AREA_COORDS } from '../../lib/areaCoords';
import { coordsForArea, saveProviderCoverage, useMyServiceAreas } from '../../api/location';
import { isApiConfigured } from '../../lib/api';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const STORAGE_KEY = 'solid-connect:service-areas';

// Every neighborhood the server can place on the map (public.area_centroids,
// mirrored in AREA_COORDS). CITY service areas reference that table, so this
// is the full set a provider can cover, not a short list of quick picks.
const ALL_AREAS = Object.keys(AREA_COORDS).sort((a, b) => a.localeCompare(b));

// Quick picks only. Any whole number of km can be typed in the field below.
const RADIUS_PRESETS_KM = [5, 10, 25, 50, 100] as const;

export function ServiceAreasScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [selected, setSelected] = useState<string[]>([]);
  const [radiusText, setRadiusText] = useState('10');
  const [radiusEnabled, setRadiusEnabled] = useState(true);
  const [primaryArea, setPrimaryArea] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: remoteAreas, isLoading } = useMyServiceAreas();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const stored = (JSON.parse(raw) as string[]).filter((a) => ALL_AREAS.includes(a));
        setSelected((prev) => (prev.length ? prev : stored));
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
      setRadiusEnabled(true);
      setRadiusText(String(Math.round(radius.radius_meters / 1000)));
    } else {
      setRadiusEnabled(false);
    }
  }, [remoteAreas]);

  const radiusKm = parseInt(radiusText.replace(/[^\d]/g, ''), 10);
  const radiusValid = !radiusEnabled || (Number.isFinite(radiusKm) && radiusKm > 0);

  const visibleAreas = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ALL_AREAS;
    return ALL_AREAS.filter((a) => a.toLowerCase().includes(needle));
  }, [query]);

  const toggle = useCallback(
    (area: string) => {
      setSelected((prev) => {
        const next = prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        if (!primaryArea || !next.includes(primaryArea)) {
          setPrimaryArea(next[0] ?? null);
        }
        return next;
      });
    },
    [primaryArea],
  );

  function selectAll() {
    setSelected(ALL_AREAS);
    if (!primaryArea) setPrimaryArea(ALL_AREAS[0]);
  }

  function clearAll() {
    setSelected([]);
    setPrimaryArea(null);
  }

  async function persist() {
    if (!radiusValid) {
      Alert.alert('Check your radius', 'Enter a radius in whole kilometres, for example 30.');
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
      if (isApiConfigured()) {
        const hub = primaryArea && selected.includes(primaryArea) ? primaryArea : selected[0];
        const coords = hub ? coordsForArea(hub) : null;
        await saveProviderCoverage({
          cityNames: selected,
          radius:
            radiusEnabled && coords
              ? { lng: coords.lng, lat: coords.lat, radiusMeters: radiusKm * 1000 }
              : null,
        });
      }
      Alert.alert(
        'Saved',
        isApiConfigured()
          ? radiusEnabled
            ? `${selected.length} neighborhoods and a ${radiusKm} km radius synced.`
            : `${selected.length} neighborhoods synced.`
          : 'Saved on this device.',
      );
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Service areas" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>
          Pick every neighborhood you cover, then set how far from your hub you are willing to travel. There is no
          limit on either.
        </Text>
        {isLoading && isApiConfigured() ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>
                Neighborhoods <Text style={styles.sectionCount}>({selected.length} of {ALL_AREAS.length})</Text>
              </Text>
              <Pressable onPress={selected.length === ALL_AREAS.length ? clearAll : selectAll} hitSlop={8}>
                <Text style={styles.link}>{selected.length === ALL_AREAS.length ? 'Clear all' : 'Select all'}</Text>
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Search size={16} strokeWidth={2} color={colors.inkFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search neighborhoods"
                placeholderTextColor={colors.inkFainter}
                autoCorrect={false}
                style={styles.searchInput}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                  <X size={16} strokeWidth={2} color={colors.inkFaint} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.chipsWrap}>
              {visibleAreas.map((area) => {
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
              {visibleAreas.length === 0 ? (
                <Text style={styles.hint}>No neighborhood matches "{query.trim()}".</Text>
              ) : null}
            </View>
            <Text style={styles.hint}>Long-press a selected area to make it the radius hub.</Text>

            <Text style={styles.section}>Service radius from hub</Text>
            <View style={styles.chipsWrap}>
              <Pressable
                onPress={() => setRadiusEnabled(false)}
                style={[styles.chip, !radiusEnabled && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, !radiusEnabled && styles.chipLabelActive]}>Neighborhoods only</Text>
              </Pressable>
              {RADIUS_PRESETS_KM.map((km) => {
                const active = radiusEnabled && radiusKm === km;
                return (
                  <Pressable
                    key={km}
                    onPress={() => {
                      setRadiusEnabled(true);
                      setRadiusText(String(km));
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{km} km</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.radiusRow, !radiusEnabled && styles.radiusRowOff]}>
              <Text style={styles.radiusLabel}>Custom radius</Text>
              <View style={styles.radiusInputWrap}>
                <TextInput
                  value={radiusEnabled ? radiusText : ''}
                  onFocus={() => setRadiusEnabled(true)}
                  onChangeText={(v) => {
                    setRadiusEnabled(true);
                    setRadiusText(v.replace(/[^\d]/g, ''));
                  }}
                  placeholder="e.g. 40"
                  placeholderTextColor={colors.inkFainter}
                  keyboardType="number-pad"
                  style={styles.radiusInput}
                />
                <Text style={styles.radiusUnit}>km</Text>
              </View>
            </View>
            {!radiusValid ? <Text style={styles.error}>Enter a radius greater than 0 km.</Text> : null}
          </>
        )}
        <Button
          variant="active"
          title={saving ? 'Saving…' : 'Save coverage'}
          onPress={persist}
          disabled={saving || selected.length === 0 || !radiusValid}
          loading={saving}
        />
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
    note: { fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 23 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    section: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.ink },
    sectionCount: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkFaint },
    link: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.active },
    hint: { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.inkFaint },
    error: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.danger },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    searchInput: { flex: 1, fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.ink, padding: 0 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.active, borderColor: colors.active },
    chipPrimary: { borderWidth: 2, borderColor: colors.activeDeep },
    chipLabel: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.ink },
    chipLabelActive: { color: colors.white },
    radiusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    radiusRowOff: { opacity: 0.6 },
    radiusLabel: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.ink },
    radiusInputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    radiusInput: {
      minWidth: 72,
      textAlign: 'right',
      fontSize: fontSizes.lg,
      fontFamily: fonts.mono,
      color: colors.ink,
      paddingVertical: 4,
      borderBottomWidth: 2,
      borderBottomColor: colors.hairlineStrong,
    },
    radiusUnit: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.inkMuted },
  });
}
