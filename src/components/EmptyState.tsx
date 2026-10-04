import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

export function EmptyState({
  title,
  subtitle,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Optional next step - an empty state that can only describe the
   * situation and never point anywhere is a dead end. */
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Icon size={22} strokeWidth={1.75} color={colors.inkFaint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? (
        <Pressable style={styles.action} onPress={action.onPress}>
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: { paddingVertical: 76, paddingHorizontal: spacing.xxl, alignItems: 'center', gap: spacing.sm },
    icon: {
      width: 56,
      height: 56,
      borderRadius: radii.lg,
      backgroundColor: colors.paperDim,
      borderWidth: 1,
      borderColor: colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    title: { fontSize: fontSizes.lg, letterSpacing: -0.2, fontFamily: fonts.bold, color: colors.ink },
    subtitle: { fontSize: fontSizes.md, color: colors.inkMuted, lineHeight: 24, textAlign: 'center', maxWidth: 290, fontFamily: fonts.regular },
    action: { marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    actionLabel: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.active, textDecorationLine: 'underline' },
  });
}
