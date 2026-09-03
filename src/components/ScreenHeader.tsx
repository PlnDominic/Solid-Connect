import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../theme';

export function ScreenHeader({
  title,
  onBack,
  dark = false,
  large = false,
}: {
  title: string;
  onBack?: () => void;
  dark?: boolean;
  large?: boolean;
}) {
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: dark ? colors.ink : colors.card, borderBottomColor: dark ? 'transparent' : colors.hairline },
        large && styles.large,
      ]}
    >
      {onBack ? (
        <View style={styles.row}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={[styles.chevron, { color: dark ? colors.white : colors.ink }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { color: dark ? colors.white : colors.ink }]}>{title}</Text>
        </View>
      ) : (
        <Text style={[large ? styles.titleLarge : styles.title, { color: dark ? colors.white : colors.ink }]}>{title}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1 },
  large: { paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chevron: { fontSize: 22, fontFamily: fonts.medium },
  title: { fontSize: 18, fontFamily: fonts.bold },
  titleLarge: { fontSize: 22, fontFamily: fonts.extrabold },
});
