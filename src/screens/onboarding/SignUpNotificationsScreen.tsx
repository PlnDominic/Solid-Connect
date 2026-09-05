import { StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { colors, fonts, radii, spacing } from '../../theme';

/**
 * Last stop right after the account (and profile row) actually exist - not
 * part of the numbered sign-up wizard, so no StepDots, same as
 * SignUpConfirmEmailScreen. Only "Enable" triggers the OS permission
 * dialog; "Not now" just records the skip and moves on, same either way.
 */
export function SignUpNotificationsScreen({
  onEnable,
  onSkip,
  loading,
}: {
  onEnable: () => void;
  onSkip: () => void;
  loading?: boolean;
}) {
  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.stamp}>
          <Bell size={15} strokeWidth={2.4} color={colors.navy} />
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>Stay in the loop</Text>
          <Text style={styles.copy}>
            Turn on notifications so you don't miss a new quote or job update the moment it happens.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="Enable notifications" variant="navy" onPress={onEnable} loading={loading} disabled={loading} />
        <Button title="Not now" variant="ghost" onPress={onSkip} disabled={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl, gap: spacing.xl },

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

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
});
