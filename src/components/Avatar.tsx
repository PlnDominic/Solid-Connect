import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Rounded-square, not circular - reads as an ID-badge photo frame, a
 * deliberate detail that keeps "verified identity" legible even in a plain
 * initials avatar, consistent with the confirmation/verification world.
 */
export function Avatar({
  initials,
  size = 48,
  bg,
  fg,
  dim = false,
}: {
  initials: string;
  size?: number;
  bg?: string;
  fg?: string;
  dim?: boolean;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const resolvedBg = bg ?? colors.paperDim;
  const resolvedFg = fg ?? colors.ink;
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: Math.max(6, size * 0.22),
          backgroundColor: dim ? 'rgba(255,255,255,0.15)' : resolvedBg,
          borderColor: dim ? 'rgba(255,255,255,0.2)' : colors.hairline,
        },
      ]}
    >
      <Text style={{ color: resolvedFg, fontFamily: fonts.extrabold, fontSize: size * 0.32 }}>{initials}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 1 },
});
}
