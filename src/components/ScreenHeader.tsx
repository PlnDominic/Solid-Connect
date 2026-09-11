import { Pressable, Text, View, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

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
  const { colors } = useTheme();
  const foreground = dark ? colors.white : colors.ink;
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: dark ? colors.ink : colors.paper },
        large && styles.large,
      ]}
    >
      {onBack ? (
        <View style={styles.row}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[
              styles.back,
              {
                backgroundColor: dark ? 'rgba(255,255,255,0.1)' : colors.paperDim,
                borderColor: dark ? 'rgba(255,255,255,0.14)' : colors.hairline,
              },
            ]}
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={foreground} />
          </Pressable>
          <Text style={[styles.title, { color: foreground, flex: 1 }]} numberOfLines={1}>{title}</Text>
        </View>
      ) : (
        <Text style={[large ? styles.titleLarge : styles.title, { color: foreground }]} numberOfLines={1}>{title}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  large: { paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: { fontSize: 18, letterSpacing: -0.3, fontFamily: fonts.bold },
  titleLarge: { fontSize: 28, letterSpacing: -0.7, fontFamily: fonts.extrabold },
});
