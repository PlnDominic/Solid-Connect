import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LocateFixed } from 'lucide-react-native';
import { AREAS } from '../constants/areas';
import { detectNearestArea, resolvedLocationFromAreaLabel, type ResolvedLocation } from '../api/location';
import { useLocationPermission } from '../hooks/useLocationPermission';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

const OTHER = 'Other';

/**
 * Accra quick-pick chips plus "Other" free text for anywhere in Ghana.
 * "Use my current location" reverse-geocodes nationwide and returns GPS
 * for PostGIS. Chips resolve to known Accra centroids.
 */
export function AreaPicker({
  value,
  onChangeValue,
  onChangeLocation,
  autoDetect = false,
}: {
  value: string;
  /** @deprecated Prefer onChangeLocation — kept for call sites that only need the label. */
  onChangeValue: (v: string) => void;
  /** Label + optional lat/lng for persisting a PostGIS point. */
  onChangeLocation?: (loc: ResolvedLocation) => void;
  /** Fill the area from the phone's location on first show, if empty. */
  autoDetect?: boolean;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const location = useLocationPermission();
  const isKnownArea = AREAS.includes(value);
  const [showOther, setShowOther] = useState(!isKnownArea && value.trim().length > 0);
  const [detecting, setDetecting] = useState(false);
  const selected = showOther ? OTHER : value;

  function emit(loc: ResolvedLocation) {
    onChangeValue(loc.area);
    onChangeLocation?.(loc);
  }

  function pick(area: string) {
    if (area === OTHER) {
      setShowOther(true);
      emit({ area: '' });
      return;
    }
    if (!AREAS.includes(area)) {
      setShowOther(true);
      emit(resolvedLocationFromAreaLabel(area));
      return;
    }
    setShowOther(false);
    emit(resolvedLocationFromAreaLabel(area));
  }

  useEffect(() => {
    if (!autoDetect || value.trim().length > 0) return;
    let cancelled = false;
    detectNearestArea().then((result) => {
      if (!cancelled && 'area' in result) {
        if (!AREAS.includes(result.area)) setShowOther(true);
        else setShowOther(false);
        emit(result);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showLocationHelp(error: 'PERMISSION_DENIED' | 'SERVICES_OFF' | 'LOCATION_UNAVAILABLE') {
    if (error === 'PERMISSION_DENIED') {
      Alert.alert(
        'Location access needed',
        Platform.OS === 'ios'
          ? 'Allow location for this app (in Expo Go: Expo Go → Location → While Using). Then try again, or pick a neighborhood below.'
          : 'Allow location access, then try again — or pick a neighborhood below.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ],
      );
      return;
    }
    if (error === 'SERVICES_OFF') {
      Alert.alert(
        'Turn on Location Services',
        Platform.OS === 'ios'
          ? 'Location Services are off on this iPhone. Open Settings → Privacy & Security → Location Services, switch them on, then try again.'
          : 'Location is off on this phone. Turn it on in Settings (or Quick Settings), then try again.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ],
      );
      return;
    }
    Alert.alert(
      "Couldn't get your location",
      'Make sure you have a clear GPS signal, then try again — or type your town in Other / pick an Accra area below.',
    );
  }

  async function useCurrentLocation() {
    setDetecting(true);
    try {
      const granted = await location.request();
      if (!granted) return;

      const result = await detectNearestArea();
      if ('error' in result) {
        showLocationHelp(result.error);
        return;
      }
      if (!AREAS.includes(result.area)) setShowOther(true);
      else setShowOther(false);
      emit(result);
    } finally {
      setDetecting(false);
    }
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable onPress={useCurrentLocation} disabled={detecting} style={styles.locateRow} hitSlop={8}>
        {detecting ? (
          <ActivityIndicator size="small" color={colors.active} />
        ) : (
          <LocateFixed size={15} strokeWidth={2.2} color={colors.active} />
        )}
        <Text style={styles.locateLabel}>{detecting ? 'Finding your area…' : 'Use my current location'}</Text>
      </Pressable>

      <View style={styles.chipsWrap}>
        {[...AREAS, OTHER].map((area) => {
          const active = area === OTHER ? showOther : !showOther && area === selected;
          return (
            <Pressable key={area} onPress={() => pick(area)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{area}</Text>
            </Pressable>
          );
        })}
      </View>

      {showOther ? (
        <TextInput
          value={value}
          onChangeText={(text) => emit({ area: text })}
          placeholder="Enter your town or neighborhood"
          placeholderTextColor={colors.inkFainter}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          style={styles.input}
        />
      ) : null}
    </View>
  );
}

/** True when the given value would leave AreaPicker in a submittable state. */
export function isValidArea(value: string): boolean {
  return AREAS.includes(value) || value.trim().length >= 2;
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    locateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start' },
    locateLabel: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.active, textDecorationLine: 'underline' },
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
    chipLabel: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.ink },
    chipLabelActive: { color: colors.white },

    input: {
      fontSize: fontSizes.lg,
      fontFamily: fonts.bold,
      color: colors.ink,
      borderBottomWidth: 2,
      borderBottomColor: colors.hairlineStrong,
      paddingVertical: spacing.md,
    },
  });
}
