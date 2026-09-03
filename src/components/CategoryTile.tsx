import { Pressable, Text, View, StyleSheet } from 'react-native';
import {
  Check,
  Wrench,
  Zap,
  Hammer,
  Building2,
  PaintBucket,
  Flame,
  Sparkles,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '../theme';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  plumbing: Wrench,
  electrical: Zap,
  carpentry: Hammer,
  masonry: Building2,
  painting: PaintBucket,
  welding: Flame,
  cleaning: Sparkles,
  ac_repair: Wind,
};

/** Grid variant used for category browsing/picking - a circular emblem
 * badge (ink ring, fills solid ink when selected) reads closer to a coin
 * or seal than a soft app icon tile, matching the hero card's register.
 * `bare` drops the outer card (border/background/padding) for a plain
 * browsing row where the badge itself carries the tap target - used on
 * the home screen; the picker keeps the card for its selectable affordance. */
export function CategoryGridTile({
  id,
  abbr,
  name,
  description,
  selected,
  onPress,
  bare = false,
}: {
  id: string;
  abbr: string;
  name: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  bare?: boolean;
}) {
  const Icon = CATEGORY_ICONS[id] ?? Wrench;
  return (
    <Pressable
      onPress={onPress}
      style={[
        bare ? styles.gridTileBare : styles.gridTile,
        !bare && selected ? styles.gridTileSelected : null,
      ]}
    >
      {selected ? (
        <View style={styles.gridCheck}>
          <Check size={11} strokeWidth={3} color={colors.white} />
        </View>
      ) : null}
      <View style={[styles.gridBadge, selected ? styles.gridBadgeSelected : null]}>
        <Icon size={21} strokeWidth={1.75} color={selected ? colors.white : colors.ink} />
      </View>
      <Text style={styles.gridName} numberOfLines={1}>
        {name}
      </Text>
      {description ? (
        <Text style={styles.gridDesc} numberOfLines={1}>
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

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
      style={[styles.row, { borderColor: selected ? colors.active : colors.hairline }]}
    >
      <View style={styles.badge}>
        <Text style={styles.abbr}>{abbr}</Text>
      </View>
      <Text style={styles.rowName}>{name}</Text>
      {selected ? (
        <View style={styles.check}>
          <Check size={12} strokeWidth={3} color={colors.white} />
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
  badge: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.paperDim, alignItems: 'center', justifyContent: 'center' },
  abbr: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.ink },
  name: { fontSize: 11, fontFamily: fonts.semibold, color: colors.inkMuted, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
  },
  rowName: { flex: 1, fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  check: { width: 20, height: 20, borderRadius: radii.sm, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  gridTile: {
    width: 136,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
  },
  gridTileSelected: {},
  gridTileBare: {
    width: 84,
    alignItems: 'center',
    gap: 3,
  },
  gridBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.paperDim,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  gridBadgeSelected: { backgroundColor: colors.active, borderColor: colors.active },
  gridCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    backgroundColor: colors.active,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridName: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.1, textAlign: 'center' },
  gridDesc: { fontSize: 11.5, fontFamily: fonts.regular, color: colors.inkMuted, textAlign: 'center' },
});
