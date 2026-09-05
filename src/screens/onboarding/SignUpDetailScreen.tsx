import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { colors, fonts, radii, spacing } from '../../theme';

/**
 * Shared layout for the sign-up detail-entry steps (name, phone, email) -
 * one focused field per screen, clean and fast, deliberately not sharing
 * the full-bleed photo treatment of the onboarding info slides or the
 * final role screen: a form reads better with nothing competing for
 * attention behind the input.
 */
export function SignUpDetailScreen({
  totalSteps,
  activeIndex,
  title,
  subtitle,
  value,
  onChangeValue,
  onBack,
  onNext,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'words',
  validate,
  nextLabel = 'Continue',
  footerExtra,
  loading = false,
  externalError,
}: {
  totalSteps: number;
  activeIndex: number;
  title: string;
  subtitle: string;
  value: string;
  onChangeValue: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  validate: (v: string) => boolean;
  nextLabel?: string;
  footerExtra?: ReactNode;
  /** Shows a spinner on the button and disables input changes from advancing again. */
  loading?: boolean;
  /** An error from outside the local format check (e.g. "already registered") - takes priority over it. */
  externalError?: string | null;
}) {
  const [touched, setTouched] = useState(false);
  const isValid = validate(value);

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
            <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
          </Pressable>
          <StepDots count={totalSteps} activeIndex={activeIndex} />
          <View style={styles.backSpacer} />
        </View>

        <View style={styles.body}>
          <View style={styles.textWrap}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <TextInput
            value={value}
            onChangeText={onChangeValue}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            placeholderTextColor={colors.inkFainter}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => isValid && !loading && onNext()}
            style={[styles.input, (touched && !isValid) || externalError ? styles.inputError : null]}
          />
          {externalError ? (
            <Text style={styles.errorText}>{externalError}</Text>
          ) : touched && !isValid ? (
            <Text style={styles.errorText}>That doesn't look right yet.</Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Button title={nextLabel} onPress={onNext} disabled={!isValid || loading} loading={loading} />
          {footerExtra}
        </View>
      </KeyboardAvoidingView>
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
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.inkMuted, fontFamily: fonts.regular },

  input: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: colors.hairlineStrong,
    paddingVertical: spacing.md,
  },
  inputError: { borderBottomColor: colors.danger },
  errorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger, marginTop: -spacing.md },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
});
