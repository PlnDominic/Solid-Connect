import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '../theme';

export interface FilterOption {
  id: string;
  label: string;
  icon?: LucideIcon;
}

/**
 * Single-select horizontal filter row. Active state uses the brand-orange
 * "active" accent (also used for the picked category) - never the
 * confirm-green accent, which stays reserved for actual verified/confirmed
 * moments, not generic selection chrome.
 */
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: FilterOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const active = option.id === value;
        const Icon = option.icon;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            {Icon ? (
              <Icon size={14} strokeWidth={2.2} color={active ? colors.white : colors.inkMuted} />
            ) : null}
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.lg },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipActive: { backgroundColor: colors.active, borderColor: colors.active },
  label: { fontSize: 13, fontFamily: fonts.semibold, color: colors.inkMuted, letterSpacing: -0.1 },
  labelActive: { color: colors.white },
});
