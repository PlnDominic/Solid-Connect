import { Text, TextInput, View, StyleSheet } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';

/**
 * A labeled input for settings-style forms (Edit profile, Account &
 * security) - distinct from SignUpDetailScreen's full-page underline input,
 * which is a one-field-at-a-time onboarding treatment. This one is meant to
 * sit several-to-a-card.
 */
export function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  secureTextEntry?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFainter}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        editable={editable}
        style={[styles.input, !editable && styles.inputDisabled]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  inputDisabled: { backgroundColor: colors.paperDim, color: colors.inkFaint },
});
