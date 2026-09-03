import { useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radii } from '../../theme';

const METHODS = [
  { id: 'momo', label: 'MTN Mobile Money', detail: '•••• 4821' },
  { id: 'vodafone', label: 'Vodafone Cash', detail: '•••• 0937' },
  { id: 'airteltigo', label: 'AirtelTigo Money', detail: 'Not linked' },
];

export function PaymentMethodsScreen({ navigation }: { navigation: any }) {
  const [selected, setSelected] = useState('momo');

  return (
    <Screen>
      <ScreenHeader title="Payment methods" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>
          Payments in this demo are simulated - no money actually moves. This is where a real payout/charge method
          would be managed.
        </Text>
        <View style={styles.card}>
          {METHODS.map((m, i) => (
            <Pressable
              key={m.id}
              onPress={() => setSelected(m.id)}
              style={[styles.row, i < METHODS.length - 1 && styles.rowBorder]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowLabel}>{m.label}</Text>
                <Text style={styles.rowDetail}>{m.detail}</Text>
              </View>
              <View style={[styles.radio, selected === m.id && styles.radioActive]}>
                {selected === m.id ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.addRow}>
          <Text style={styles.addLabel}>+ Add payment method</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 16 },
  note: { fontSize: 13, color: colors.textFaint, lineHeight: 19 },
  card: { borderRadius: radii.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textHeading },
  rowDetail: { fontSize: 12, color: colors.textFaint },
  radio: { width: 20, height: 20, borderRadius: 999, borderWidth: 1.5, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: colors.ink },
  addRow: { alignItems: 'center', paddingVertical: 14 },
  addLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.orangeDeep },
});
