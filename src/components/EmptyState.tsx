import { Text, View, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '../theme';

export function EmptyState({
  title,
  subtitle,
  icon: Icon = Inbox,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Icon size={22} strokeWidth={1.75} color={colors.inkFaint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: 16, letterSpacing: -0.2, fontFamily: fonts.bold, color: colors.ink },
  subtitle: { fontSize: 13, color: colors.inkMuted, lineHeight: 20, textAlign: 'center', maxWidth: 260, fontFamily: fonts.regular },
});
