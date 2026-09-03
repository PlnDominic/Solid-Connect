import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { colors, fonts, radii, spacing } from '../../theme';
import type { Role } from '../../types/database';

/**
 * Role step of sign-up, between email and password - same layout as the
 * other detail-entry steps (header, top-aligned title/copy, footer
 * action), just with two role buttons instead of a text field. Picking a
 * role here just advances to the password step; the account (and the
 * profile row with this role) is only created once that succeeds.
 */
export function SignUpScreen({
  firstName,
  totalSteps,
  activeIndex,
  onBack,
  onSelectRole,
  loading,
  errorMessage,
}: {
  firstName: string;
  totalSteps: number;
  activeIndex: number;
  onBack: () => void;
  onSelectRole: (role: Role) => void;
  loading?: Role | null;
  errorMessage?: string | null;
}) {
  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} disabled={!!loading} hitSlop={12} style={styles.back}>
          <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
        </Pressable>
        <StepDots count={totalSteps} activeIndex={activeIndex} />
        <View style={styles.backSpacer} />
      </View>

      <View style={styles.body}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Almost there, {firstName}</Text>
          <Text style={styles.copy}>
            How will you use Solid Connect - post a job and get matched with verified pros, or get hired
            for jobs nearby?
          </Text>
        </View>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Button
          title="Continue as customer"
          variant="navy"
          onPress={() => onSelectRole('customer')}
          loading={loading === 'customer'}
          disabled={!!loading}
        />
        <Button
          title="Continue as provider"
          variant="outline"
          onPress={() => onSelectRole('provider')}
          loading={loading === 'provider'}
          disabled={!!loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  backSpacer: { width: 32 },

  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl },
  textWrap: { gap: 8 },
  title: { fontSize: 26, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 32 },
  copy: { fontSize: 15, lineHeight: 22, color: colors.inkMuted, fontFamily: fonts.regular },
  errorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
});
