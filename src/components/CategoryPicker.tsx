import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCategories } from '../api/marketplace';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

type SingleProps = {
  multi?: false;
  value: string;
  onChangeValue: (v: string) => void;
  values?: never;
  onChangeValues?: never;
};

type MultiProps = {
  multi: true;
  values: string[];
  onChangeValues: (ids: string[]) => void;
  value?: never;
  onChangeValue?: never;
};

/**
 * Chip grid of service categories. Single-select (name) or multi-select (category ids).
 */
export function CategoryPicker(props: SingleProps | MultiProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: categories, isLoading, isError } = useCategories();
  const multi = props.multi === true;

  if (isLoading) return <ActivityIndicator color={colors.ink} />;
  if (isError || !categories?.length) {
    return (
      <Text style={styles.errorText}>Couldn't load categories. Check your connection and try again.</Text>
    );
  }

  function toggle(id: string, name: string) {
    if (multi) {
      const selected = props.values;
      const next = selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id];
      props.onChangeValues(next);
      return;
    }
    props.onChangeValue(name);
  }

  return (
    <View style={styles.chipsWrap}>
      {categories.map((category) => {
        const active = multi
          ? props.values.includes(category.id)
          : category.name === props.value;
        return (
          <Pressable
            key={category.id}
            onPress={() => toggle(category.id, category.name)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{category.name}</Text>
          </Pressable>
        );
      })}
      {multi ? (
        <Text style={styles.hint}>Select every service you offer. Customers can find you in each one.</Text>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    errorText: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.danger, lineHeight: 21 },
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
    chipLabel: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.ink },
    chipLabelActive: { color: colors.paper },
    hint: {
      width: '100%',
      marginTop: spacing.sm,
      fontSize: fontSizes.xs,
      lineHeight: 17,
      fontFamily: fonts.medium,
      color: colors.inkFaint,
    },
  });
}
