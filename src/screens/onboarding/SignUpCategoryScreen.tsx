import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPicker } from '../../components/CategoryPicker';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Provider sign-up: pick every service you offer. Category ids are stored in
 * provider_categories so browse/search can match any of them.
 */
export function SignUpCategoryScreen({
  totalSteps,
  activeIndex,
  values,
  onChangeValues,
  onBack,
  onNext,
  loading = false,
  errorMessage,
}: {
  totalSteps: number;
  activeIndex: number;
  values: string[];
  onChangeValues: (ids: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  loading?: boolean;
  errorMessage?: string | null;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const isValid = values.length > 0;

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
          <Text style={styles.title}>What services do you offer?</Text>
          <Text style={styles.subtitle}>
            Pick every trade you do. Customers can find you when they search for any of them.
          </Text>
        </View>

        <CategoryPicker multi values={values} onChangeValues={onChangeValues} />
      </ScrollView>

      <View style={styles.footer}>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <Button title="Continue" onPress={onNext} disabled={!isValid || loading} loading={loading} />
      </View>
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

    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl },
    textWrap: { gap: 8 },
    title: { fontSize: 26, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 32 },
    subtitle: { fontSize: 15, lineHeight: 22, color: colors.inkMuted, fontFamily: fonts.regular },
    errorText: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.danger, lineHeight: 20 },

    footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  });
}
