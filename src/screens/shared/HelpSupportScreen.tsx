import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const SUPPORT_EMAIL = 'cosolid93@gmail.com';
const supportNumber = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP?.trim() ?? '';
const whatsappNumber = /^\+?[1-9][0-9]{6,14}$/.test(supportNumber) ? supportNumber.replace(/^\+/, '') : null;

const FAQS = [
  { q: 'How does Solid Connect verify providers?', a: 'Providers go through identity checks, and the highest tier earns a Solid Connect certified badge shown on their profile.' },
  { q: 'How do payments work?', a: 'You agree the price with your provider and pay them directly, in cash or Mobile Money, once the work is done. Solid Connect does not take or hold payment. You confirm completion in the app, and can open a dispute if something goes wrong.' },
  { q: 'What if a provider cancels?', a: 'Check Activity for updates. You can post a new job or contact another provider.' },
];

export function HelpSupportScreen({ navigation, route }: { navigation: any; route?: { params?: { jobId?: string } } }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [failedLink, setFailedLink] = useState<string | null>(null);
  const jobId = route?.params?.jobId;
  const subject = jobId ? `Help with job ${jobId}` : 'Solid Connect support';
  const emailLink = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  const whatsappLink = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(subject)}` : null;

  async function openContact(url: string) {
    setFailedLink(null);
    try {
      await Linking.openURL(url);
    } catch {
      setFailedLink(url);
    }
  }

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Help & support" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {jobId ? (
          <Button title="Open or view a dispute" variant="outline" onPress={() => navigation.navigate('Dispute', { jobId })} />
        ) : null}
        <View style={styles.cardShadow}>
        <View style={styles.card}>
          {whatsappLink ? (
            <Pressable style={styles.contactRow} onPress={() => void openContact(whatsappLink)} accessibilityRole="link">
              <Text style={styles.contactLabel}>Chat on WhatsApp</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.contactRow} onPress={() => void openContact(emailLink)} accessibilityRole="link">
            <Text style={styles.contactLabel}>Email support</Text>
            <Text style={styles.contactValue}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>
        </View>

        {failedLink ? (
          <View>
            <Text style={styles.faqA} accessibilityLiveRegion="polite">Could not open this contact option.</Text>
            <Button title="Retry" variant="outline" onPress={() => void openContact(failedLink)} />
          </View>
        ) : null}
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
    cardShadow: { borderRadius: radii.xxxl, backgroundColor: colors.card, ...shadow.card },
    card: { borderRadius: radii.xxxl, overflow: 'hidden' },
    contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingHorizontal: spacing.lg },
    contactLabel: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.ink },
    contactValue: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.ink },
    sectionTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.ink },
    faqCard: { borderRadius: radii.xxxl, backgroundColor: colors.card, padding: spacing.md, gap: 6, ...shadow.card },
    faqQ: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    faqA: { fontSize: fontSizes.md, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 23 },
  });
}
