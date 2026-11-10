import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { ChevronRight, MapPin, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The app's dark banner card. On the customer Home it is "Find Trusted
 * Providers Near You"; on the provider Feed it shows availability. Slides in
 * on mount, then loops a soft light sweep across the card, a bobbing map pin
 * (when `pin` is on) and a pulsing ring behind the emblem (when `pulse` is
 * on). Motion stops entirely when the person has Reduce Motion turned on.
 */
export function PromoBanner({
  title = 'Find Trusted Providers Near You',
  subtitle = 'Verified pros, real ratings, right in your neighborhood.',
  eyebrow = 'VERIFIED NEAR YOU',
  icon: Icon = ShieldCheck,
  accent,
  pin = true,
  pulse: pulseOn = true,
  onPress,
}: {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  /** Colour of the emblem, its pulse and the eyebrow. Defaults to brand orange. */
  accent?: string;
  /** The bobbing map pin on the emblem. */
  pin?: boolean;
  /** The pulsing ring behind the emblem. */
  pulse?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const tint = accent ?? colors.active;
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.delay(1600),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
      ...(pin
        ? [
            Animated.loop(
              Animated.sequence([
                Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              ]),
            ),
          ]
        : []),
      ...(pulseOn
        ? [
            Animated.loop(
              Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
              ]),
            ),
          ]
        : []),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, pin, pulseOn, enter, sweep, bob, pulse]);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-120, Math.max(width, 200) + 120] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Animated.View
      onLayout={onLayout}
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${eyebrow}. ${title}. ${subtitle}`}
      >
        {!reduceMotion ? (
          <Animated.View pointerEvents="none" style={[styles.sweep, { transform: [{ translateX: sweepX }, { rotate: '18deg' }] }]} />
        ) : null}

        <View style={styles.emblem}>
          {pulseOn && !reduceMotion ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.pulseRing, { backgroundColor: tint, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
            />
          ) : null}
          <View style={[styles.emblemInner, { backgroundColor: tint }]}>
            <Icon size={22} strokeWidth={2.2} color={colors.white} />
          </View>
          {pin ? (
            <Animated.View style={[styles.pin, { transform: [{ translateY: bobY }] }]}>
              <MapPin size={13} strokeWidth={2.6} color={tint} fill={colors.white} />
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.eyebrow, { color: tint }]}>{eyebrow}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>

        <View style={styles.arrow}>
          <ChevronRight size={18} strokeWidth={2.6} color={colors.black} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.xxl,
      backgroundColor: colors.black,
      overflow: 'hidden',
    },
    cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
    sweep: {
      position: 'absolute',
      top: -40,
      bottom: -40,
      width: 60,
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    emblem: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    pulseRing: {
      position: 'absolute',
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.active,
    },
    emblemInner: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.active,
    },
    pin: { position: 'absolute', top: -2, right: -2 },
    textWrap: { flex: 1, gap: 2 },
    eyebrow: { color: colors.active, fontSize: fontSizes.xs, letterSpacing: 0.9, fontFamily: fonts.extrabold },
    title: { color: colors.white, fontSize: fontSizes.md, letterSpacing: -0.3, fontFamily: fonts.extrabold },
    subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: fontSizes.xs, lineHeight: 16, fontFamily: fonts.medium },
    arrow: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
    },
  });
}
