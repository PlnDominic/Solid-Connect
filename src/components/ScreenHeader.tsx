import { Pressable, Text, View, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '../theme';

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
  const foreground = dark ? colors.white : colors.ink;
  return (
    <View style={[styles.wrap, dark && styles.darkWrap, large && styles.large]}>
      {onBack ? (
        <View style={styles.row}>
          <Pressable onPress={onBack} hitSlop={12} style={[styles.back, dark && styles.backDark]}>
            <ChevronLeft size={20} strokeWidth={2.4} color={foreground} />
          </Pressable>
          <Text style={[styles.title, { color: foreground }]}>{title}</Text>
        </View>
      ) : (
        <Text style={[large ? styles.titleLarge : styles.title, { color: foreground }]}>{title}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.paper },
  darkWrap: { backgroundColor: colors.ink },
  large: { paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperDim,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  backDark: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.14)' },
  title: { fontSize: 18, letterSpacing: -0.3, fontFamily: fonts.bold },
  titleLarge: { fontSize: 28, letterSpacing: -0.7, fontFamily: fonts.extrabold },
});
