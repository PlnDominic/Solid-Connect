import { Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radii, spacing } from '../../theme';

const FAQS = [
  { q: 'How does Solid Connect verify providers?', a: 'Providers go through identity checks, and the highest tier earns a Solid Connect certified badge shown on their profile.' },
  { q: 'How do payments work?', a: 'You confirm completion once the job is done, which releases payment to the provider. You can open a dispute within 48 hours.' },
  { q: 'What if a provider cancels?', a: "You'll be notified immediately and can request quotes from other nearby providers at no extra cost." },
];

export function HelpSupportScreen({ navigation }: { navigation: any }) {
  return (
    <Screen>
      <ScreenHeader title="Help & support" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@solidconnect.app')}>
            <Text style={styles.contactLabel}>Email support</Text>
            <Text style={styles.contactValue}>support@solidconnect.app</Text>
          </Pressable>
          <View style={styles.rowBorder} />
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL('tel:+233200000000')}>
            <Text style={styles.contactLabel}>Call support</Text>
            <Text style={styles.contactValue}>+233 20 000 0000</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Frequently asked</Text>
        <View style={{ gap: spacing.md }}>
          {FAQS.map((f) => (
            <View key={f.q} style={styles.faqCard}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Text style={styles.faqA}>{f.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl },
  card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingHorizontal: spacing.lg },
  rowBorder: { height: 1, backgroundColor: colors.hairline },
  contactLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  contactValue: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  faqCard: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.card, padding: spacing.md, gap: 6 },
  faqQ: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  faqA: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
});
