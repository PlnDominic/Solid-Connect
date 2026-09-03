import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * Rounded-square, not circular - reads as an ID-badge photo frame, a
 * deliberate detail that keeps "verified identity" legible even in a plain
 * initials avatar, consistent with the confirmation/verification world.
 */
export function Avatar({
  initials,
  size = 48,
  bg = colors.paperDim,
  fg = colors.ink,
  dim = false,
}: {
  initials: string;
  size?: number;
  bg?: string;
  fg?: string;
  dim?: boolean;
}) {
  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: Math.max(6, size * 0.22),
          backgroundColor: dim ? 'rgba(255,255,255,0.15)' : bg,
          borderColor: dim ? 'rgba(255,255,255,0.2)' : colors.hairline,
        },
      ]}
    >
      <Text style={{ color: fg, fontFamily: fonts.extrabold, fontSize: size * 0.32 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 1 },
});
