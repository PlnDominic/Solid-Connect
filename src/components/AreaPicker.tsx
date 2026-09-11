import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AREAS } from '../constants/areas';
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

  return (
    <View style={{ gap: spacing.lg }}>
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
