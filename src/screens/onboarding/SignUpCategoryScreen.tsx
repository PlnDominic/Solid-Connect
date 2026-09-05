import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPicker } from '../../components/CategoryPicker';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { colors, fonts, radii, spacing } from '../../theme';

/**
 * Provider-only sign-up step - which trade shows up on their profile and
 * feeds the marketplace's category filter (useAllProviders matches on this
 * exact name, see src/api/marketplace.ts). CategoryPicker sources it live
 * from the real `categories` table rather than a hardcoded list.
 */
export function SignUpCategoryScreen({
  totalSteps,
  activeIndex,
  value,
  onChangeValue,
  onBack,
  onNext,
  loading = false,
  errorMessage,
}: {
  totalSteps: number;
  activeIndex: number;
  value: string;
  onChangeValue: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  loading?: boolean;
  errorMessage?: string | null;
}) {
  const isValid = value.trim().length > 0;

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} disabled={loading} hitSlop={12} style={styles.back}>
          <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
        </Pressable>
        <StepDots count={totalSteps} activeIndex={activeIndex} />
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>What's your trade?</Text>
          <Text style={styles.subtitle}>
            This is how customers will find you when they're looking for help.
          </Text>
        </View>

        <CategoryPicker value={value} onChangeValue={onChangeValue} />
      </ScrollView>

      <View style={styles.footer}>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <Button title="Continue" onPress={onNext} disabled={!isValid || loading} loading={loading} />
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

  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl },
  textWrap: { gap: 8 },
  title: { fontSize: 26, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 32 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.inkMuted, fontFamily: fonts.regular },
  errorText: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.danger, lineHeight: 20 },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
});
