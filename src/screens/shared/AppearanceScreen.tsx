import { Moon, Sun } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme, type ThemeScheme } from '../../theme/ThemeProvider';

const OPTIONS: { id: ThemeScheme; label: string; detail: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', detail: 'White receipt ground, near-black ink', Icon: Sun },
  { id: 'dark', label: 'Dark', detail: 'Ink ground for low-light use', Icon: Moon },
];

export function AppearanceScreen({ navigation }: { navigation: any }) {
  const { colors, scheme, setScheme } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Screen>
      <ScreenHeader title="Appearance" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>Choose how Solid Connect looks on this device. Your choice is saved here only.</Text>
        <View style={styles.cardShadow}>
        <View style={styles.card}>
          {OPTIONS.map((opt, i) => {
            const active = scheme === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setScheme(opt.id)}
                style={[styles.row, i < OPTIONS.length - 1 && styles.rowBorder]}
              >
                <opt.Icon size={18} strokeWidth={2} color={colors.ink} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowLabel}>{opt.label}</Text>
                  <Text style={styles.rowDetail}>{opt.detail}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
    cardShadow: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      ...shadow.card,
    },
    card: {
      borderRadius: radii.lg,
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
  });
}
