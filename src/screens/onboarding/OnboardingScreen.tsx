import { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { colors, fonts, spacing } from '../../theme';

interface Slide {
  icon: string;
  iconColor: string;
  title: string;
  body: string;
  cta: string;
  backgroundImage?: ImageSourcePropType;
}

const SLIDES: Slide[] = [
  {
    icon: '⟳',
    iconColor: colors.navy,
    title: 'Post a job in minutes',
    body: "Describe what you need fixed and we'll match you with verified plumbers, electricians and artisans near you.",
    cta: 'Next',
  },
  {
    icon: '⇄',
    iconColor: colors.orange,
    title: 'Compare quotes from verified pros',
    body: 'See ratings, prices and availability side by side, then chat directly with the provider you choose.',
    cta: 'Next',
    backgroundImage: require('../../../assets/images/onboarding/onboarding-2.jpg'),
  },
  {
    icon: '⊙',
    iconColor: colors.navy,
    title: 'Enable your location',
    body: 'We use your location to find verified pros near you in Accra and estimate accurate arrival times.',
    cta: 'Allow location access',
    backgroundImage: require('../../../assets/images/onboarding/onboarding-3.jpg'),
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    fade.setValue(0);
    slideY.setValue(8);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, [step, fade, slideY]);

  const slide = SLIDES[step];
  const isLocationStep = step === SLIDES.length - 1;
  const hasBackground = !!slide.backgroundImage;

  const content = (
    <Animated.View style={[styles.fill, { opacity: fade, transform: [{ translateY: slideY }] }]}>
      <View style={styles.skipRow}>
        <Pressable onPress={onDone} hitSlop={12}>
          <Text style={[styles.skip, hasBackground && styles.skipOnImage]}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        {hasBackground ? null : (
          <View style={styles.iconWrap}>
            <Text style={[styles.icon, { color: slide.iconColor }]}>{slide.icon}</Text>
          </View>
        )}
        <View style={styles.textWrap}>
          <Text style={[styles.title, hasBackground && styles.titleOnImage]}>{slide.title}</Text>
          <Text style={[styles.body, hasBackground && styles.bodyOnImage]}>{slide.body}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <StepDots count={SLIDES.length} activeIndex={step} />
        <Button
          title={slide.cta}
          onPress={() => (isLocationStep ? onDone() : setStep((s) => s + 1))}
        />
        {isLocationStep ? (
          <Pressable onPress={onDone}>
            <Text style={[styles.notNow, hasBackground && styles.notNowOnImage]}>Not now</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.fill}>
      {hasBackground ? (
        <ImageBackground source={slide.backgroundImage} style={styles.fill} resizeMode="cover">
          <View style={styles.overlay} />
          <SafeAreaView style={styles.fill}>{content}</SafeAreaView>
        </ImageBackground>
      ) : (
        <SafeAreaView style={styles.fill}>{content}</SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.white },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,14,20,0.45)' },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  skip: { fontSize: 14, fontFamily: fonts.semibold, color: 'rgba(17,17,19,0.5)' },
  skipOnImage: { color: 'rgba(255,255,255,0.85)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xxl, paddingHorizontal: 32 },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: colors.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 42, fontFamily: fonts.extrabold },
  textWrap: { gap: 10, alignItems: 'center' },
  title: { fontSize: 24, fontFamily: fonts.extrabold, color: colors.ink, textAlign: 'center', letterSpacing: -0.2 },
  titleOnImage: { color: colors.white },
  body: { fontSize: 15, lineHeight: 23, color: 'rgba(17,17,19,0.6)', textAlign: 'center', maxWidth: 280 },
  bodyOnImage: { color: 'rgba(255,255,255,0.85)' },
  footer: { paddingHorizontal: 28, paddingBottom: 40, gap: 20 },
  notNow: { textAlign: 'center', fontSize: 14, fontFamily: fonts.semibold, color: 'rgba(17,17,19,0.5)' },
  notNowOnImage: { color: 'rgba(255,255,255,0.85)' },
});
