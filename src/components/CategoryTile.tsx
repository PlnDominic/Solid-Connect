import { Image, Pressable, Text, View, StyleSheet } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
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
  Leaf,
  Truck,
  Bug,
  KeyRound,
  Refrigerator,
  Car,
  Camera,
  Video,
  ChefHat,
  PartyPopper,
  Scissors,
  Pipette,
  Dumbbell,
  Laptop,
  BookOpen,
  Palette,
  ShieldCheck,
  Mic,
  Megaphone,
  Calculator,
  Wifi,
  MapPin,
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
  landscaping: Leaf,
  moving_hauling: Truck,
  pest_control: Bug,
  locksmith: KeyRound,
  appliance_repair: Refrigerator,
  auto_mechanic: Car,
  photography: Camera,
  videography: Video,
  catering: ChefHat,
  event_planning: PartyPopper,
  tailoring: Scissors,
  beauty_salon: Pipette,
  fitness_training: Dumbbell,
  it_support: Laptop,
  tutoring: BookOpen,
  interior_design: Palette,
  security_services: ShieldCheck,
  dj_sound: Mic,
  marketing_design: Megaphone,
  accounting: Calculator,
  web_tech: Wifi,
  real_estate: MapPin,
};

// Glossy 3D renders (CC0, 3dicons.co) used only for the large Home grid -
// at the small sizes every other variant (compact row, picker) renders at,
// a flat vector icon stays crisper than a scaled-down raster illustration.
const CATEGORY_ILLUSTRATIONS: Record<string, ImageSourcePropType> = {
  plumbing: require('../../assets/categories/plumbing.png'),
  electrical: require('../../assets/categories/electrical.png'),
  carpentry: require('../../assets/categories/carpentry.png'),
  masonry: require('../../assets/categories/masonry.png'),
  painting: require('../../assets/categories/painting.png'),
  welding: require('../../assets/categories/welding.png'),
  cleaning: require('../../assets/categories/cleaning.png'),
  ac_repair: require('../../assets/categories/ac_repair.png'),
  landscaping: require('../../assets/categories/landscaping.png'),
  moving_hauling: require('../../assets/categories/moving_hauling.png'),
  pest_control: require('../../assets/categories/pest_control.png'),
  locksmith: require('../../assets/categories/locksmith.png'),
  appliance_repair: require('../../assets/categories/appliance_repair.png'),
  auto_mechanic: require('../../assets/categories/auto_mechanic.png'),
  photography: require('../../assets/categories/photography.png'),
  videography: require('../../assets/categories/videography.png'),
  catering: require('../../assets/categories/catering.png'),
  event_planning: require('../../assets/categories/event_planning.png'),
  tailoring: require('../../assets/categories/tailoring.png'),
  beauty_salon: require('../../assets/categories/beauty_salon.png'),
  fitness_training: require('../../assets/categories/fitness_training.png'),
  it_support: require('../../assets/categories/it_support.png'),
  tutoring: require('../../assets/categories/tutoring.png'),
  interior_design: require('../../assets/categories/interior_design.png'),
  security_services: require('../../assets/categories/security_services.png'),
  dj_sound: require('../../assets/categories/dj_sound.png'),
  marketing_design: require('../../assets/categories/marketing_design.png'),
  accounting: require('../../assets/categories/accounting.png'),
  web_tech: require('../../assets/categories/web_tech.png'),
  real_estate: require('../../assets/categories/real_estate.png'),
};

type CategoryAccent = { surface: string; border: string; foreground: string };

const CATEGORY_ACCENTS: Record<string, { light: CategoryAccent; dark: CategoryAccent }> = {
  plumbing: { light: { surface: '#E7F1FF', border: '#B8D4F5', foreground: '#1455A3' }, dark: { surface: '#102D4D', border: '#245A91', foreground: '#8CC4FF' } },
  electrical: { light: { surface: '#FFF3CC', border: '#F2D376', foreground: '#855400' }, dark: { surface: '#3A2B08', border: '#80631A', foreground: '#FFD86B' } },
  carpentry: { light: { surface: '#F8E7D7', border: '#E9BB93', foreground: '#8A4317' }, dark: { surface: '#3B2010', border: '#7C431F', foreground: '#FFB98A' } },
  masonry: { light: { surface: '#F1E9E6', border: '#D6BDB6', foreground: '#70453A' }, dark: { surface: '#342521', border: '#684940', foreground: '#E9C5BA' } },
  painting: { light: { surface: '#F1E8FF', border: '#D4BDF5', foreground: '#6740A4' }, dark: { surface: '#2D1F47', border: '#5B3D8A', foreground: '#C9A6FF' } },
  welding: { light: { surface: '#FFE8E2', border: '#F0B7A8', foreground: '#A23A25' }, dark: { surface: '#401D17', border: '#873E2F', foreground: '#FFAC9B' } },
  cleaning: { light: { surface: '#DDF5ED', border: '#A9DDCC', foreground: '#17684F' }, dark: { surface: '#12392D', border: '#28725A', foreground: '#87E1C1' } },
  ac_repair: { light: { surface: '#E0F4F8', border: '#A9DCE5', foreground: '#126B7A' }, dark: { surface: '#10373E', border: '#28727F', foreground: '#80D9E7' } },
  landscaping: { light: { surface: '#E3F5E1', border: '#B7E3B0', foreground: '#276E3D' }, dark: { surface: '#12321C', border: '#2C6B3F', foreground: '#9CE0A8' } },
  moving_hauling: { light: { surface: '#F3E6D8', border: '#E0C6A4', foreground: '#7A4E1E' }, dark: { surface: '#3A2A15', border: '#7A5A2E', foreground: '#E8C48F' } },
  pest_control: { light: { surface: '#EAF0DA', border: '#CBDBA0', foreground: '#4B5E1E' }, dark: { surface: '#2B330F', border: '#5A6B2A', foreground: '#C7D98F' } },
  locksmith: { light: { surface: '#E7EAF0', border: '#C3CBDA', foreground: '#3A4560' }, dark: { surface: '#202636', border: '#454F6E', foreground: '#AAB6D6' } },
  appliance_repair: { light: { surface: '#E6EAF7', border: '#C0CBEB', foreground: '#33418F' }, dark: { surface: '#1D2240', border: '#3C4A8A', foreground: '#A9B7EE' } },
  auto_mechanic: { light: { surface: '#E9EBED', border: '#C7CCD1', foreground: '#33383E' }, dark: { surface: '#24272B', border: '#4A5058', foreground: '#C7CDD6' } },
  photography: { light: { surface: '#EFEAE6', border: '#D8CCC2', foreground: '#4A372A' }, dark: { surface: '#2A2320', border: '#5A493C', foreground: '#E4C9AE' } },
  videography: { light: { surface: '#E4EDFB', border: '#B9D0F2', foreground: '#1B4E96' }, dark: { surface: '#142A47', border: '#2E5C93', foreground: '#9FC4F2' } },
  catering: { light: { surface: '#FBEAE3', border: '#F0C3AE', foreground: '#A3421C' }, dark: { surface: '#3A1D12', border: '#7A3B22', foreground: '#F0A87F' } },
  event_planning: { light: { surface: '#FBE7F0', border: '#F0BFDA', foreground: '#A02463' }, dark: { surface: '#3A1729', border: '#7A2F54', foreground: '#F0A0C8' } },
  tailoring: { light: { surface: '#F7E6F5', border: '#E5B9E0', foreground: '#7A2B74' }, dark: { surface: '#331730', border: '#6B2E64', foreground: '#E4A6DC' } },
  beauty_salon: { light: { surface: '#FCE7EA', border: '#F2BEC8', foreground: '#A02B45' }, dark: { surface: '#391A20', border: '#7A2F41', foreground: '#F0A3B4' } },
  fitness_training: { light: { surface: '#EDF6DE', border: '#CDE6A8', foreground: '#4F6D1B' }, dark: { surface: '#263312', border: '#547226', foreground: '#D0E896' } },
  it_support: { light: { surface: '#E1F5F7', border: '#ADE0E6', foreground: '#146672' }, dark: { surface: '#12333A', border: '#2A6E79', foreground: '#9BE0EA' } },
  tutoring: { light: { surface: '#E7E9FB', border: '#C1C6F0', foreground: '#37409B' }, dark: { surface: '#1E2148', border: '#3A428F', foreground: '#AEB4F0' } },
  interior_design: { light: { surface: '#F0E6FB', border: '#D6BCF0', foreground: '#6B2FA0' }, dark: { surface: '#2E1B45', border: '#5F3A85', foreground: '#CBA3EE' } },
  security_services: { light: { surface: '#E5EAF5', border: '#B9C6E8', foreground: '#1F3A78' }, dark: { surface: '#182240', border: '#33477F', foreground: '#A6BAEE' } },
  dj_sound: { light: { surface: '#EFE7FB', border: '#D2BEF2', foreground: '#5B2B9E' }, dark: { surface: '#281642', border: '#533084', foreground: '#C6A6F0' } },
  marketing_design: { light: { surface: '#FBE9E4', border: '#F0C0B0', foreground: '#A3401F' }, dark: { surface: '#3A1D14', border: '#7A3E24', foreground: '#F0AB8C' } },
  accounting: { light: { surface: '#E1F3EE', border: '#ABDBCB', foreground: '#16694E' }, dark: { surface: '#12332A', border: '#2A705A', foreground: '#93E0C4' } },
  web_tech: { light: { surface: '#E3F1FC', border: '#B4D9F4', foreground: '#1D6199' }, dark: { surface: '#16324A', border: '#326C97', foreground: '#9FCBEE' } },
  real_estate: { light: { surface: '#FBEAE5', border: '#F0C0B2', foreground: '#A3391F' }, dark: { surface: '#3A1D14', border: '#7A3823', foreground: '#F0A98C' } },
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
  colorful = false,
  homeGrid = false,
}: {
  id: string;
  abbr: string;
  name: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  bare?: boolean;
  compact?: boolean;
  /** Applies the category's semantic accent palette; used for Home discovery. */
  colorful?: boolean;
  /** Large three-column category card used only on Home. */
  homeGrid?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors);
  const Icon = CATEGORY_ICONS[id] ?? Wrench;
  const illustration = CATEGORY_ILLUSTRATIONS[id];
  const accent = colorful ? CATEGORY_ACCENTS[id]?.[scheme] : undefined;
  // The Home grid gets the full glossy illustration (large enough to read
  // well); every other, smaller variant keeps the crisp vector icon.
  const useIllustration = homeGrid && illustration && !selected;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Choose ${name}`}
      style={({ pressed }) => [
        bare ? styles.gridTileBare : homeGrid ? styles.gridTileHome : compact ? styles.gridTileCompact : styles.gridTile,
        !bare && selected ? styles.gridTileSelected : null,
        accent ? { backgroundColor: accent.surface, borderWidth: 1, borderColor: accent.border } : null,
        pressed ? styles.gridTilePressed : null,
      ]}
    >
      {selected ? (
        <View style={styles.gridCheck}>
          <Check size={11} strokeWidth={3} color={colors.paper} />
        </View>
      ) : null}
      {useIllustration ? (
        // Floats directly on the accent card, no badge chip behind it - the
        // illustration already carries its own shading/depth, and a white
        // circle behind it would just add a redundant nested-card look.
        <Image source={illustration} style={styles.gridIllustration} resizeMode="contain" />
      ) : (
        <View
          style={[
            homeGrid ? styles.gridBadgeHome : compact ? styles.gridBadgeCompact : styles.gridBadge,
            selected ? styles.gridBadgeSelected : null,
            accent && !selected ? { backgroundColor: colors.card, borderColor: accent.border } : null,
          ]}
        >
          <Icon size={homeGrid ? 50 : compact ? 17 : 21} strokeWidth={homeGrid ? 1.45 : 1.75} color={selected ? colors.paper : accent?.foreground ?? colors.ink} />
        </View>
      )}
      <Text style={[styles.gridName, compact && styles.gridNameCompact, homeGrid && styles.gridNameHome, accent && !selected ? { color: accent.foreground } : null]} numberOfLines={2}>
        {name}
      </Text>
      {description ? (
        <Text style={[styles.gridDesc, compact && styles.gridDescCompact, accent && !selected ? { color: accent.foreground, opacity: 0.74 } : null]} numberOfLines={1}>
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
  const { colors, scheme } = useTheme();
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
  const { colors, scheme } = useTheme();
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
      width: 112,
      minHeight: 124,
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 6,
      padding: spacing.md,
      borderRadius: radii.xl,
    },
    gridTilePressed: { opacity: 0.82, transform: [{ scale: 0.975 }] },
    gridTileHome: {
      width: 76,
      alignItems: 'center',
      gap: 6,
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
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.paperDim,
      borderWidth: 1.5,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    gridBadgeHome: {
      width: 76,
      height: 76,
      borderRadius: 28,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    gridBadgeSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    gridIllustration: { width: 44, height: 44 },
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
    gridNameCompact: { fontSize: 13, fontFamily: fonts.bold, textAlign: 'left' },
    gridNameHome: { fontSize: 11, lineHeight: 14, fontFamily: fonts.bold, textAlign: 'center' },
    gridDesc: { fontSize: 11.5, fontFamily: fonts.regular, color: colors.inkMuted, textAlign: 'center' },
    gridDescCompact: { fontSize: 10.5, lineHeight: 14, fontFamily: fonts.medium, textAlign: 'left' },
  });
}
