import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { colors, fonts, radii, spacing } from '../../theme';

interface Slide {
  title: string;
  body: string;
  cta: string;
  heroImage: ImageSourcePropType;
  /** Marks the confirmation-type final step - uses the reserved accent. */
  isConfirmStep?: boolean;
}

const SLIDES: Slide[] = [
  {
    title: 'Post a job in minutes',
    body: "Describe what you need fixed and we'll match you with verified plumbers, electricians and artisans near you.",
    cta: 'Next',
    heroImage: require('../../../assets/images/onboarding/onboarding-1.png'),
  },
  {
    title: 'Compare quotes from verified pros',
    body: 'See ratings, prices and availability side by side, then chat directly with the provider you choose.',
    cta: 'Next',
    heroImage: require('../../../assets/images/onboarding/onboarding-2.jpg'),
  },
  {
    title: 'Enable your location',
    body: 'We use your location to find verified pros near you in Accra and estimate accurate arrival times.',
    cta: 'Allow location access',
    heroImage: require('../../../assets/images/onboarding/onboarding-3.jpg'),
    isConfirmStep: true,
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    fade.setValue(0);
    slideY.setValue(10);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [step, fade, slideY]);

  const slide = SLIDES[step];
  const isLocationStep = step === SLIDES.length - 1;
  const animatedStyle = { opacity: fade, transform: [{ translateY: slideY }] };

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.skipRow}>
        <Pressable onPress={onDone} hitSlop={14}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.body, animatedStyle]}>
        <View style={styles.photoFrame}>
          <Image source={slide.heroImage} style={styles.photo} resizeMode="cover" />
          {slide.isConfirmStep ? (
            <View style={styles.stamp}>
              <ShieldCheck size={15} strokeWidth={2.4} color={colors.navy} />
            </View>
          ) : null}
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.copy}>{slide.body}</Text>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <StepDots count={SLIDES.length} activeIndex={step} />
        <Button
          title={slide.cta}
          variant={slide.isConfirmStep ? 'navy' : 'primary'}
          onPress={() => (isLocationStep ? onDone() : setStep((s) => s + 1))}
        />
        {isLocationStep ? (
          <Pressable onPress={onDone}>
            <Text style={styles.notNow}>Not now</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  skip: { fontSize: 15, fontFamily: fonts.medium, color: colors.inkFaint, letterSpacing: 0.1 },

  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.xxl },

  photoFrame: {
    flex: 1,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  stamp: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.navy,
    borderRadius: radii.pill,
  },

  textWrap: { gap: 8 },
  title: {
    fontSize: 25,
    fontFamily: fonts.extrabold,
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 31,
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkMuted,
    fontFamily: fonts.regular,
  },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  notNow: {
    textAlign: 'center',
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: colors.inkFaint,
    letterSpacing: 0.1,
  },
});
