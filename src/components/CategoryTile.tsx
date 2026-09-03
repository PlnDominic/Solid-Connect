import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../theme';

export function CategoryTile({
  abbr,
  name,
  selected,
  onPress,
}: {
  abbr: string;
  name: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <View style={styles.badge}>
        <Text style={styles.abbr}>{abbr}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

/** Row variant used in the new-request category picker (with a check mark). */
export function CategoryRow({
  abbr,
  name,
  selected,
  onPress,
}: {
  abbr: string;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { borderColor: selected ? colors.ink : colors.hairline }]}
    >
      <View style={styles.badge}>
        <Text style={styles.abbr}>{abbr}</Text>
      </View>
      <Text style={styles.rowName}>{name}</Text>
      {selected ? (
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  badge: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' },
  abbr: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.ink },
  name: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textBody, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
  },
  rowName: { flex: 1, fontSize: 15, fontFamily: fonts.semibold, color: colors.textHeading },
  check: { width: 20, height: 20, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: colors.white, fontSize: 12, fontFamily: fonts.extrabold },
});
