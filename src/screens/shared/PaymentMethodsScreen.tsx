import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, radii, shadow, spacing } from '../../theme';
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
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Payment methods" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>
          Job payments open Hubtel checkout (Mobile Money or card). The wallet you pick here is a preference on this device; the charge itself happens in Hubtel.
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
          <Text style={styles.addLabel}>Checkout uses your Hubtel wallet at payment time</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    note: { fontSize: 15, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 22 },
    card: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.card,
      ...shadow.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    rowLabel: { fontSize: 16, fontFamily: fonts.semibold, color: colors.ink },
    rowDetail: { fontSize: 14, fontFamily: fonts.medium, color: colors.inkFaint },
    radio: {
      width: 20,
      height: 20,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: colors.active },
    radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.active },
    addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md },
    addLabel: { fontSize: 14.5, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
