import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, fonts } from '../../theme';

const logo = require('../../../assets/images/logo.jpeg');

// Mirrors the prototype's splash: logo starts zoomed in (1.9x) and eases
// down to 1x over 6s, the "Accra, Ghana" caption fades in near the end,
// then the whole screen cross-fades out into onboarding/home.
const ZOOM_MS = 6000;
const CAPTION_DELAY_MS = 4800;
const CAPTION_MS = 700;
const FADE_OUT_START_MS = 5800;
const FADE_OUT_MS = 400;
const TOTAL_MS = 6200;

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const scale = useRef(new Animated.Value(1.9)).current;
  const captionOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: ZOOM_MS,
      easing: Easing.bezier(0.16, 0.85, 0.3, 1),
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.delay(CAPTION_DELAY_MS),
      Animated.timing(captionOpacity, { toValue: 1, duration: CAPTION_MS, useNativeDriver: true }),
    ]).start();

    const fadeTimer = setTimeout(() => {
      Animated.timing(screenOpacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start();
    }, FADE_OUT_START_MS);
    const finishTimer = setTimeout(onFinish, TOTAL_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.fill, { opacity: screenOpacity }]}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Animated.Image source={logo} style={[styles.logo, { transform: [{ scale }] }]} resizeMode="contain" />
        <Animated.Text style={[styles.caption, { opacity: captionOpacity }]}>Accra, Ghana</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  logo: { width: 150, height: 84 },
  caption: { fontSize: 13, letterSpacing: 0.6, color: 'rgba(17,17,19,0.45)', fontFamily: fonts.medium },
});
