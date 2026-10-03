import { Alert, Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const SUPPORT_PHONE = '+233 30 200 0000';
const SUPPORT_EMAIL = 'support@solidconnect.app';

const FAQS = [
  { q: 'How does Solid Connect verify providers?', a: 'Providers go through identity checks, and the highest tier earns a Solid Connect certified badge shown on their profile.' },
  { q: 'How do payments work?', a: 'You confirm completion once the job is done, which releases payment to the provider. You can open a dispute within 48 hours.' },
  { q: 'What if a provider cancels?', a: "You'll be notified immediately and can request quotes from other nearby providers at no extra cost." },
];

export function HelpSupportScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  function handleCallSupport() {
    Alert.alert(
      'Call customer support?',
      `Speak with a Solid Connect support agent in Accra at ${SUPPORT_PHONE}. Standard call rates apply.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`).catch(() => {
              Alert.alert('Could not dial', 'Your device could not open the phone dialer.');
            });
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Help & support" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.cardShadow}>
        <View style={styles.card}>
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Text style={styles.contactLabel}>Email support</Text>
            <Text style={styles.contactValue}>{SUPPORT_EMAIL}</Text>
          </Pressable>
          <View style={styles.rowBorder} />
          <Pressable style={styles.contactRow} onPress={handleCallSupport}>
            <Text style={styles.contactLabel}>Call support</Text>
            <Text style={styles.contactValue}>{SUPPORT_PHONE}</Text>
          </Pressable>
        </View>
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

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.xl },
    cardShadow: { borderRadius: radii.lg, backgroundColor: colors.card, ...shadow.card },
    card: { borderRadius: radii.lg, overflow: 'hidden' },
    contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingHorizontal: spacing.lg },
    rowBorder: { height: 1, backgroundColor: colors.hairline },
    contactLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    contactValue: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
    sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    faqCard: { borderRadius: radii.lg, backgroundColor: colors.card, padding: spacing.md, gap: 6, ...shadow.card },
    faqQ: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
    faqA: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
  });
}
