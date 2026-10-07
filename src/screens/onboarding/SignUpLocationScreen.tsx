import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ResolvedLocation } from '../../api/location';
import { AreaPicker, isValidArea } from '../../components/AreaPicker';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Same chip picker as ServiceAreasScreen via AreaPicker — Accra shortcuts
 * plus "Other" / GPS for anywhere in Ghana. GPS also yields lat/lng for
 * PostGIS matching.
 */
export function SignUpLocationScreen({
  totalSteps,
  activeIndex,
  value,
  onChangeValue,
  onChangeLocation,
  onBack,
  onNext,
}: {
  totalSteps: number;
  activeIndex: number;
  value: string;
  onChangeValue: (v: string) => void;
  onChangeLocation?: (loc: ResolvedLocation) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const isValid = isValidArea(value);

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
          </Pressable>
          <StepDots count={totalSteps} activeIndex={activeIndex} />
          <View style={styles.backSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.textWrap}>
            <Text style={styles.title}>Where are you based?</Text>
            <Text style={styles.subtitle}>
              Anywhere in Ghana. Use your current location, pick a common Accra area, or type your town.
            </Text>
          </View>

          <AreaPicker
            value={value}
            onChangeValue={onChangeValue}
            onChangeLocation={onChangeLocation}
            autoDetect
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Continue" onPress={onNext} disabled={!isValid} />
        </View>
      </KeyboardAvoidingView>
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
    title: { fontSize: fontSizes.title, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4, lineHeight: 34 },
    subtitle: { fontSize: fontSizes.md, lineHeight: 23, color: colors.inkMuted, fontFamily: fonts.regular },

    footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  });
}
