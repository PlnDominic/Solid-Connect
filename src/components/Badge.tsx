import { Text, View, StyleSheet } from 'react-native';
import { fonts, radii } from '../theme';

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.sm, alignSelf: 'flex-start' },
  label: { fontSize: 12, fontFamily: fonts.bold, letterSpacing: 0.1 },
});
