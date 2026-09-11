import { Share2 } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function ReferralScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const code = (profile?.full_name ?? 'SOLID')
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 3)
    .concat((profile?.id ?? 'SC').slice(0, 4).toUpperCase());

  async function handleShare() {
    try {
      await Share.share({
        message: `Join me on Solid Connect - trusted home services in Accra. Use my invite code ${code} when you sign up.`,
      });
    } catch {
      Alert.alert('Could not open share sheet', 'Copy your invite code manually: ' + code);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Invite friends" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lead}>
          Grow the marketplace. When friends join with your code, they land among verified providers instead of cold listings.
        </Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
          <Text style={styles.codeValue}>{code}</Text>
        </View>
        <Pressable style={styles.shareBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share invite code">
          <Share2 size={16} strokeWidth={2.2} color={colors.white} />
          <Text style={styles.shareLabel}>Share invite</Text>
        </Pressable>
        <Text style={styles.note}>
          Rewards for successful invites are not live yet - sharing still helps fill the Accra supply and demand sides.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    lead: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
    codeCard: {
      borderRadius: radii.xl,
      backgroundColor: colors.navy,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    codeLabel: { fontSize: 10.5, fontFamily: fonts.extrabold, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.8 },
    codeValue: { fontSize: 28, fontFamily: fonts.mono, color: colors.white, letterSpacing: 2 },
    shareBtn: {
      height: 52,
      borderRadius: radii.lg,
      backgroundColor: colors.ink,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    shareLabel: { fontSize: 15, fontFamily: fonts.bold, color: colors.paper },
    note: { fontSize: 12, lineHeight: 18, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
