import { useState } from 'react';
import { Plus } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radii, spacing } from '../../theme';

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
          <Plus size={16} strokeWidth={2.4} color={colors.ink} />
          <Text style={styles.addLabel}>Add payment method</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
  card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, paddingHorizontal: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  rowDetail: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
  radio: { width: 20, height: 20, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.ink },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md },
  addLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
});
