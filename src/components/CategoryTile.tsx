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
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

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
  compact = false,
}: {
  id: string;
  abbr: string;
  name: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  bare?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const Icon = CATEGORY_ICONS[id] ?? Wrench;
  return (
    <Pressable
      onPress={onPress}
      style={[
        bare ? styles.gridTileBare : compact ? styles.gridTileCompact : styles.gridTile,
        !bare && selected ? styles.gridTileSelected : null,
      ]}
    >
      {selected ? (
        <View style={styles.gridCheck}>
          <Check size={11} strokeWidth={3} color={colors.paper} />
        </View>
      ) : null}
      <View
        style={[
          compact ? styles.gridBadgeCompact : styles.gridBadge,
          selected ? styles.gridBadgeSelected : null,
        ]}
      >
        <Icon size={compact ? 17 : 21} strokeWidth={1.75} color={selected ? colors.paper : colors.ink} />
      </View>
      <Text style={[styles.gridName, compact && styles.gridNameCompact]} numberOfLines={1}>
        {name}
      </Text>
      {description ? (
        <Text style={[styles.gridDesc, compact && styles.gridDescCompact]} numberOfLines={1}>
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
          <Check size={12} strokeWidth={3} color={colors.paper} />
        </View>
      ) : null}
    </Pressable>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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
    gridTileCompact: {
      width: 92,
      alignItems: 'center',
      gap: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: 6,
      borderRadius: radii.lg,
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
    gridBadgeCompact: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.paperDim,
      borderWidth: 1.5,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    gridBadgeSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    gridCheck: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 20,
      height: 20,
      borderRadius: radii.sm,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridName: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.1, textAlign: 'center' },
    gridNameCompact: { fontSize: 12, fontFamily: fonts.semibold },
    gridDesc: { fontSize: 11.5, fontFamily: fonts.regular, color: colors.inkMuted, textAlign: 'center' },
    gridDescCompact: { fontSize: 10, fontFamily: fonts.regular },
  });
}
