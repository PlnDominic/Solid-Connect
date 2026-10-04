import { Pressable, ScrollView, Text, StyleSheet } from 'react-native';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

export interface ToggleOption {
  id: string;
  label: string;
  on: boolean;
}

/**
 * A row of independent on/off chips (unlike FilterChips, where exactly one
 * option is picked). Same look as FilterChips so the two read as one system.
 */
export function ToggleChips({ options, onToggle }: { options: ToggleOption[]; onToggle: (id: string) => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onToggle(o.id)}
          style={[styles.chip, o.on && styles.chipOn]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: o.on }}
        >
          <Text style={[styles.label, o.on && styles.labelOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    scroll: { marginHorizontal: -spacing.lg },
    row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    chip: {
      height: 36,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    label: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkMuted, letterSpacing: -0.1 },
    labelOn: { color: colors.white },
  });
}
