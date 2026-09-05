import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCategories } from '../api/marketplace';
import { colors, fonts, radii, spacing } from '../theme';

/**
 * Chip grid of service categories, sourced live from the real `categories`
 * table (the same source of truth src/api/marketplace.ts filters on) -
 * shared between the sign-up trade step and profile editing.
 */
export function CategoryPicker({ value, onChangeValue }: { value: string; onChangeValue: (v: string) => void }) {
  const { data: categories, isLoading, isError } = useCategories();

  if (isLoading) return <ActivityIndicator color={colors.ink} />;
  if (isError || !categories?.length) {
    return <Text style={styles.errorText}>Couldn't load categories. Check your connection and try again.</Text>;
  }

  return (
    <View style={styles.chipsWrap}>
      {categories.map((category) => {
        const active = category.name === value;
        return (
          <Pressable
            key={category.id}
            onPress={() => onChangeValue(category.name)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{category.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  errorText: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.danger, lineHeight: 20 },
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
  chipLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  chipLabelActive: { color: colors.white },
});
