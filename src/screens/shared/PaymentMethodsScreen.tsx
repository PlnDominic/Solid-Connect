import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const STORAGE_KEY = 'solid-connect:payment-method';

const METHODS = [
  { id: 'momo', label: 'MTN Mobile Money', detail: 'Primary MoMo wallet' },
  { id: 'vodafone', label: 'Vodafone Cash', detail: 'Alternate mobile money' },
  { id: 'airteltigo', label: 'AirtelTigo Money', detail: 'Alternate mobile money' },
];

export function PaymentMethodsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [selected, setSelected] = useState('momo');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw && METHODS.some((m) => m.id === raw)) setSelected(raw);
      })
      .catch(() => {});
  }, []);

  function choose(id: string) {
    setSelected(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }

  return (
    <Screen>
      <ScreenHeader title="Payment methods" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>
          Your preferred method is saved on this device. Live MoMo/card charging is not connected yet - confirming a
          job still only moves simulated payment rows.
        </Text>
        <View style={styles.card}>
          {METHODS.map((m, i) => (
            <Pressable
              key={m.id}
              onPress={() => choose(m.id)}
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
        <View style={styles.addRow}>
          <Plus size={16} strokeWidth={2.4} color={colors.inkFaint} />
          <Text style={styles.addLabel}>Linking a new wallet arrives with live payments</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.hairline,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    rowDetail: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    radio: {
      width: 20,
      height: 20,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: colors.ink },
    radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.ink },
    addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md },
    addLabel: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
