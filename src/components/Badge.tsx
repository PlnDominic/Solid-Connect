import { Text, View, StyleSheet } from 'react-native';
import { fonts } from '../theme';

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  label: { fontSize: 12, fontFamily: fonts.bold },
});
