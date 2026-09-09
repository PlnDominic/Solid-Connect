import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const SECTIONS = [
  {
    title: 'Terms of service',
    body: 'Solid Connect connects customers in Accra with verified service providers. By using the app you agree to post accurate job details, keep communication on-platform where possible, and treat the other party with respect. Quotes and job confirmations create a binding engagement between customer and provider; Solid Connect facilitates matching, chat, and (when live) payment rails but is not the employer of providers.',
  },
  {
    title: 'Privacy',
    body: 'We store your profile, job history, chat messages, and verification documents to run the marketplace. Photos you upload (profile, portfolio, request attachments, verification) are stored in Supabase Storage under access rules that match their purpose. We do not sell personal data. You can request account deletion by contacting support.',
  },
  {
    title: 'Payments & disputes',
    body: 'Until live mobile-money / card rails ship, payment screens are simulated. When live payments land, releasing payment after job confirmation moves funds per the agreed quote, subject to platform commission. Open a dispute from a job within the window shown on that screen if work was incomplete, poor quality, overcharged, or a no-show.',
  },
];

export function LegalScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Screen>
      <ScreenHeader title="Terms & privacy" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.bodyText}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md },
    card: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    title: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    bodyText: { fontSize: 13.5, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
  });
}
