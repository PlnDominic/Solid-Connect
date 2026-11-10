import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import { setupProgress, type SetupItem, type SetupKey } from '../lib/providerSetup';
import { fonts, fontSizes, radii, shadow, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/** A short checklist for a new provider, shown on the Feed until every step
 * is done. Tapping a step opens the screen that completes it. */
export function ProviderSetupCard({ items, onOpen }: { items: SetupItem[]; onOpen: (key: SetupKey) => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { done, total, complete } = setupProgress(items);
  if (complete) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Get set up to win jobs</Text>
        <Text style={styles.count}>
          {done} of {total} done
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${(done / total) * 100}%` }]} />
      </View>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onOpen(item.key)}
          disabled={item.done}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityState={{ disabled: item.done }}
          accessibilityLabel={`${item.title}. ${item.done ? 'Done' : item.detail}`}
        >
          <View style={[styles.tick, item.done && styles.tickDone]}>
            {item.done ? <Check size={13} strokeWidth={3} color={colors.white} /> : null}
          </View>
          <View style={styles.text}>
            <Text style={[styles.rowTitle, item.done && styles.rowTitleDone]}>{item.title}</Text>
            {item.done ? null : <Text style={styles.rowDetail}>{item.detail}</Text>}
          </View>
          {item.done ? null : <ChevronRight size={16} strokeWidth={2.4} color={colors.inkFaint} />}
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: { borderRadius: radii.xxl, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.md, ...shadow.card },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    title: { fontSize: fontSizes.md, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.2 },
    count: { fontSize: fontSizes.xs, fontFamily: fonts.bold, color: colors.inkFaint },
    bar: { height: 6, borderRadius: 3, backgroundColor: colors.paperDim, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3, backgroundColor: colors.active },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
    rowPressed: { opacity: 0.7 },
    tick: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tickDone: { backgroundColor: colors.confirm, borderColor: colors.confirm },
    text: { flex: 1, gap: 1 },
    rowTitle: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.ink },
    rowTitleDone: { color: colors.inkFaint, textDecorationLine: 'line-through', fontFamily: fonts.medium },
    rowDetail: { fontSize: fontSizes.xs, lineHeight: 17, fontFamily: fonts.medium, color: colors.inkMuted },
  });
}
