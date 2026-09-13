import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { LEGAL_SECTIONS } from '../../lib/legal';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Role } from '../../types/database';

/**
 * Role step of sign-up, between email and password - same layout as the
 * other detail-entry steps (header, top-aligned title/copy, footer
 * action), just with two role buttons instead of a text field. Picking a
 * role here just advances to the password step; the account (and the
 * profile row with this role) is only created once that succeeds.
 *
 * Also where sign-up consent lives: the earliest point common to BOTH
 * the password sign-up path and the already-authenticated Google/Apple
 * path (which never sees the password step at all), so this is the one
 * place a checkbox here can gate account creation for either route.
 */
export function SignUpScreen({
  firstName,
  totalSteps,
  activeIndex,
  onBack,
  onSelectRole,
  loading,
  errorMessage,
  termsAccepted,
  onToggleTerms,
}: {
  firstName: string;
  totalSteps: number;
  activeIndex: number;
  onBack: () => void;
  onSelectRole: (role: Role) => void;
  loading?: Role | null;
  errorMessage?: string | null;
  termsAccepted: boolean;
  onToggleTerms: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [showLegal, setShowLegal] = useState(false);
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
        <View style={styles.termsRow}>
          <Pressable onPress={onToggleTerms} hitSlop={8} style={styles.termsCheck} disabled={!!loading}>
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted ? <Check size={12} strokeWidth={3} color={colors.white} /> : null}
            </View>
            <Text style={styles.termsText}>I agree to the Terms & Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => setShowLegal(true)} hitSlop={8}>
            <Text style={styles.termsLink}>View</Text>
          </Pressable>
        </View>

        <Button
          title="Continue as customer"
          variant="navy"
          onPress={() => onSelectRole('customer')}
          loading={loading === 'customer'}
          disabled={!!loading || !termsAccepted}
        />
        <Button
          title="Continue as provider"
          variant="outline"
          onPress={() => onSelectRole('provider')}
          loading={loading === 'provider'}
          disabled={!!loading || !termsAccepted}
        />
      </View>

      <BottomSheet visible={showLegal} onClose={() => setShowLegal(false)}>
        <ScrollView style={styles.legalScroll} contentContainerStyle={styles.legalBody}>
          <Text style={styles.legalHeading}>Terms & Privacy</Text>
          {LEGAL_SECTIONS.map((section) => (
            <View key={section.title} style={styles.legalCard}>
              <Text style={styles.legalCardTitle}>{section.title}</Text>
              <Text style={styles.legalCardBody}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
        <Button title="Close" variant="outline" onPress={() => setShowLegal(false)} />
      </BottomSheet>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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

    termsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 },
    termsCheck: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: radii.sm,
      borderWidth: 1.5,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.ink, borderColor: colors.ink },
    termsText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkMuted, flexShrink: 1 },
    termsLink: { fontSize: 12.5, fontFamily: fonts.bold, color: colors.ink, textDecorationLine: 'underline' },

    legalScroll: { maxHeight: 420 },
    legalBody: { gap: spacing.md, paddingBottom: spacing.md },
    legalHeading: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.ink },
    legalCard: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.paperDim,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    legalCardTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
    legalCardBody: { fontSize: 13, lineHeight: 20, fontFamily: fonts.regular, color: colors.inkMuted },
  });
}
