import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LocateFixed } from 'lucide-react-native';
import { AREAS } from '../constants/areas';
import { detectNearestArea } from '../api/location';
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

const OTHER = 'Other';

/**
 * Chip grid of Accra neighborhoods plus an "Other" fallback text field -
 * shared between the sign-up location step and profile editing, so there's
 * one place that knows what a valid area looks like.
 */
export function AreaPicker({ value, onChangeValue }: { value: string; onChangeValue: (v: string) => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const isKnownArea = AREAS.includes(value);
  const [showOther, setShowOther] = useState(!isKnownArea && value.trim().length > 0);
  const [detecting, setDetecting] = useState(false);
  const selected = showOther ? OTHER : value;

  function pick(area: string) {
    if (area === OTHER) {
      setShowOther(true);
      onChangeValue('');
      return;
    }
    setShowOther(false);
    onChangeValue(area);
  }

  async function useCurrentLocation() {
    setDetecting(true);
    try {
      const result = await detectNearestArea();
      if ('error' in result) {
        Alert.alert(
          result.error === 'PERMISSION_DENIED' ? 'Location access needed' : "Couldn't get your location",
          result.error === 'PERMISSION_DENIED'
            ? 'Allow location access to detect your neighborhood automatically, or pick one below.'
            : 'Please try again, or pick your neighborhood below.',
        );
        return;
      }
      pick(result.area);
    } finally {
      setDetecting(false);
    }
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable onPress={useCurrentLocation} disabled={detecting} style={styles.locateRow} hitSlop={8}>
        {detecting ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <LocateFixed size={15} strokeWidth={2.2} color={colors.ink} />
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
          onChangeText={onChangeValue}
          placeholder="Enter your neighborhood"
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
    locateLabel: { fontSize: 13.5, fontFamily: fonts.bold, color: colors.ink, textDecorationLine: 'underline' },
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
    chipLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    chipLabelActive: { color: colors.paper },

    input: {
      fontSize: 18,
      fontFamily: fonts.bold,
      color: colors.ink,
      borderBottomWidth: 2,
      borderBottomColor: colors.hairlineStrong,
      paddingVertical: spacing.md,
    },
  });
}
