import { Text, View, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../theme';

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Text style={{ color: colors.textFaint, fontSize: 20 }}>◎</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 60, paddingHorizontal: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.hairlineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textFaint, lineHeight: 19, textAlign: 'center', maxWidth: 240 },
});
