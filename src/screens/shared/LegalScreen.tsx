import { Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radii, spacing } from '../../theme';

const APP_VERSION = '1.0.0';

const LINKS = [
  { label: 'Terms of service', url: 'https://solidconnect.app/terms' },
  { label: 'Privacy policy', url: 'https://solidconnect.app/privacy' },
  { label: 'Open source licenses', url: 'https://solidconnect.app/licenses' },
];

export function LegalScreen({ navigation }: { navigation: any }) {
  return (
    <Screen>
      <ScreenHeader title="Legal" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          {LINKS.map((l, i) => (
            <Pressable
              key={l.label}
              onPress={() => Linking.openURL(l.url)}
              style={[styles.row, i < LINKS.length - 1 && styles.rowBorder]}
            >
              <Text style={styles.rowLabel}>{l.label}</Text>
              <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.version}>Solid Connect · Version {APP_VERSION}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl },
  card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingHorizontal: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  version: { textAlign: 'center', fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
});
