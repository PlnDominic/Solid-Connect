import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, MailCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { colors, fonts, radii, spacing } from '../../theme';

/**
 * Shown only when the Supabase project has "Confirm email" enabled, so
 * sign-up doesn't return an active session - the account exists, but
 * needs the emailed link clicked before it can sign in. Same clean,
 * top-aligned layout as the other sign-up steps (header, left-aligned
 * title/copy, footer button) - no centered/icon-hero treatment.
 */
export function SignUpConfirmEmailScreen({ email, onGoToSignIn }: { email: string; onGoToSignIn: () => void }) {
  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onGoToSignIn} hitSlop={12} style={styles.back}>
          <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.stamp}>
          <MailCheck size={15} strokeWidth={2.4} color={colors.navy} />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.copy}>
            We sent a confirmation link to <Text style={styles.email}>{email}</Text>. Open it, then come
            back and sign in.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="I've confirmed, sign in" onPress={onGoToSignIn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  back: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperDim,
    borderWidth: 1,
    borderColor: colors.hairline,
  },

  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl },

  stamp: {
    alignSelf: 'flex-start',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navyBg,
    borderWidth: 1,
    borderColor: colors.navy,
    borderRadius: radii.pill,
  },

  textWrap: { gap: 8 },
  title: { fontSize: 26, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 32 },
  copy: { fontSize: 15, lineHeight: 22, color: colors.inkMuted, fontFamily: fonts.regular },
  email: { fontFamily: fonts.bold, color: colors.ink },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
});
