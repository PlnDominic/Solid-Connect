import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

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
    cta: 'Turn on location',
    heroImage: require('../../../assets/images/onboarding/onboarding-3.jpg'),
    isConfirmStep: true,
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [step, setStep] = useState(0);
  const location = useLocationPermission();
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
  const locationBlocked = location.blocked;
  const animatedStyle = { opacity: fade, transform: [{ translateY: slideY }] };

  // Location is required, so this step only continues once the phone's
  // location is actually usable (already on counts, e.g. on a re-install).
  async function handleCta() {
    if (!isLocationStep) return setStep((s) => s + 1);
    if (location.state === 'granted') return onDone();
    if (locationBlocked) return location.openSettings();
    await location.request();
  }

  // Coming back from Settings with location switched on continues by itself.
  useEffect(() => {
    if (isLocationStep && location.attempted && location.state === 'granted') onDone();
  }, [isLocationStep, location.attempted, location.state, onDone]);

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.skipRow}>
        {isLocationStep ? null : (
          <Pressable onPress={() => setStep(SLIDES.length - 1)} hitSlop={14}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
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
          {isLocationStep && (location.state === 'denied' || location.state === 'services_off' || location.attempted) ? (
            <Text style={styles.deniedHint}>{location.helpText}</Text>
          ) : null}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <StepDots count={SLIDES.length} activeIndex={step} />
        <Button
          title={isLocationStep && locationBlocked ? 'Reload' : slide.cta}
          variant={slide.isConfirmStep ? 'navy' : 'primary'}
          onPress={handleCta}
        />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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
    deniedHint: { fontSize: 13.5, lineHeight: 20, fontFamily: fonts.medium, color: colors.danger },
  });
}
