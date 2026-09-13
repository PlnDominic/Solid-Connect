import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAddSavedLocation, useSavedLocations } from '../api/savedLocations';
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { AreaPicker, isValidArea } from './AreaPicker';

/**
 * AreaPicker plus the "address book" shortcuts on top of it - a repeat
 * customer's saved areas as one-tap chips, and a way to save the current
 * one. Self-contained (own data fetching, own styles) so it drops into
 * any screen that currently just renders a bare label + AreaPicker, like
 * NewRequestScreen's two location fields.
 */
export function LocationField({
  label = 'Location',
  value,
  onChangeValue,
  userId,
}: {
  label?: string;
  value: string;
  onChangeValue: (v: string) => void;
  userId: string | null;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: savedLocations = [] } = useSavedLocations(userId);
  const addSaved = useAddSavedLocation();
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const alreadySaved = savedLocations.some((l) => l.area === value);
  const canOfferSave = !!userId && isValidArea(value) && !alreadySaved;

  function handleSave() {
    if (!userId || !newLabel.trim()) return;
    addSaved.mutate({ userId, label: newLabel.trim(), area: value });
    setNewLabel('');
    setSaving(false);
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>

      {savedLocations.length > 0 ? (
        <View style={styles.chipsRow}>
          {savedLocations.map((loc) => {
            const active = loc.area === value;
            return (
              <Pressable
                key={loc.id}
                onPress={() => onChangeValue(loc.area)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{loc.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <AreaPicker value={value} onChangeValue={onChangeValue} />

      {canOfferSave ? (
        saving ? (
          <View style={styles.saveRow}>
            <TextInput
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="Name it - Home, Work…"
              placeholderTextColor={colors.inkFainter}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              style={styles.saveInput}
            />
            <Pressable onPress={handleSave} hitSlop={8} disabled={!newLabel.trim()}>
              <Text style={[styles.saveAction, !newLabel.trim() && styles.saveActionDisabled]}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setSaving(false)} hitSlop={8}>
              <Text style={styles.saveCancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setSaving(true)} hitSlop={8}>
            <Text style={styles.saveLink}>+ Save this location</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    fieldLabel: { fontSize: 12.5, fontFamily: fonts.semibold, color: colors.inkFaint, letterSpacing: 0.2 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
    chipLabelActive: { color: colors.white },
    saveLink: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink, textDecorationLine: 'underline' },
    saveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    saveInput: {
      flex: 1,
      height: 40,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      paddingHorizontal: spacing.md,
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.ink,
    },
    saveAction: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },
    saveActionDisabled: { color: colors.inkFainter },
    saveCancel: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
