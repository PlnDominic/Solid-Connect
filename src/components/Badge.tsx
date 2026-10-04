import { ReactNode } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { fonts, fontSizes, radii } from '../theme';

export function Badge({ label, bg, fg, icon }: { label: string; bg: string; fg: string; icon?: ReactNode }) {
  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.sm, alignSelf: 'flex-start' },
  label: { fontSize: fontSizes.xs, fontFamily: fonts.bold, letterSpacing: 0.1 },
});
