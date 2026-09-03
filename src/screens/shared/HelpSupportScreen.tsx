import { Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radii } from '../../theme';

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
        <View style={{ gap: 12 }}>
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
  body: { padding: 16, gap: 20 },
  card: { borderRadius: radii.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingHorizontal: 16 },
  rowBorder: { height: 1, backgroundColor: colors.hairlineSoft },
  contactLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textHeading },
  contactValue: { fontSize: 13, color: colors.orangeDeep, fontFamily: fonts.semibold },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  faqCard: { borderRadius: radii.lg, backgroundColor: colors.tile, padding: 14, gap: 6 },
  faqQ: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  faqA: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
