import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

export function Avatar({
  initials,
  size = 48,
  bg = colors.tile,
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
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dim ? 'rgba(255,255,255,0.15)' : bg,
        },
      ]}
    >
      <Text style={{ color: fg, fontFamily: fonts.extrabold, fontSize: size * 0.3 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
