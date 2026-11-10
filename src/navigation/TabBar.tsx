import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { House, LayoutGrid, ClipboardList, Map as MapIcon, MessageCircle, User } from 'lucide-react-native';
import { useLocale, type TranslationKey } from '../i18n';
import { haptics } from '../lib/haptics';
import { fonts, fontSizes } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { useSessionStore } from '../store/useSessionStore';
import { useUnreadChatCount, useUnreadNotificationCount } from '../api/badges';

const routeIcons: Record<string, LucideIcon> = {
  HomeTab: House,
  FeedTab: LayoutGrid,
  MapTab: MapIcon,
  ActivityTab: ClipboardList,
  ChatTab: MessageCircle,
  ProfileTab: User,
};

// Keyed by tab route name rather than by the tabBarLabel string each
// navigator passes, so every screen's translated label lives in one place
// instead of duplicated across CustomerTabs.tsx and ProviderTabs.tsx.
const routeLabelKeys: Record<string, TranslationKey> = {
  HomeTab: 'tab.home',
  FeedTab: 'tab.feed',
  MapTab: 'tab.map',
  ActivityTab: 'tab.activity',
  ChatTab: 'tab.chat',
  ProfileTab: 'tab.profile',
};

const ICON_SIZE = 22;
/** Height of the glass bar itself. */
export const TAB_BAR_HEIGHT = 64;
const LENS_INSET = 4;
/** How far a finger moves sideways before a touch becomes a drag of the lens. */
const DRAG_SLOP = 8;

/**
 * Space the floating tab bar covers at the bottom of a tab's main screen.
 * Those screens scroll underneath the glass, so their scroll content adds
 * this much bottom padding to keep the last item reachable.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + 24;
}

/** Which tab carries which unread counter, if any. The TabBar renders on
 * every screen for the whole session, so the counters live in tiny,
 * cheap hooks (src/api/badges.ts) rather than the screen-level queries. */
function useTabBadges(): Record<string, number> {
  const profile = useSessionStore((s) => s.profile);
  const userId = profile?.id ?? null;
  const chat = useUnreadChatCount(userId, profile?.role ?? 'customer');
  const notifications = useUnreadNotificationCount(userId);
  if (!profile) return {};
  return {
    ChatTab: chat.data ?? 0,
    ProfileTab: notifications.data ?? 0,
  };
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/**
 * The app's tab bar, in liquid glass.
 *
 * - The bar is frosted glass that lets the screen behind it show through. On
 *   each tab's main screen it floats over the content, so lists scroll
 *   underneath it; on screens deeper in a tab it sits below the content as
 *   before, so their bottom buttons are never covered. iOS blurs what is
 *   behind; Android shows it through a translucent tint (a real blur there
 *   would need the whole screen wrapped in a blur target).
 * - The selected tab sits under an orange glass lens. Press and slide along
 *   the bar to drag the lens to another tab; let go to open it. A tap works
 *   as before, and the lens glides to the tab that was tapped.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, scheme } = useTheme();
  const isDark = scheme === 'dark';
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const badgeCounts = useTabBadges();
  const role = useSessionStore((st) => st.profile?.role ?? 'customer');
  const reduceMotion = useReduceMotion();

  const count = state.routes.length;
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth > 0 ? barWidth / count : 0;

  // Floats over the content only on a tab's first screen (see the comment above).
  const focusedRoute = state.routes[state.index];
  const onRootScreen = ((focusedRoute.state as { index?: number } | undefined)?.index ?? 0) === 0;

  // The lens position (px from the bar's left edge) and how "lifted" it is.
  const lensX = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragStartX = useRef(0);
  const lastHover = useRef<number | null>(null);

  const xForIndex = (i: number) => i * tabWidth;

  // Glide to the selected tab whenever it changes or the bar is measured.
  useEffect(() => {
    if (!tabWidth) return;
    const to = xForIndex(state.index);
    if (reduceMotion) lensX.setValue(to);
    else Animated.spring(lensX, { toValue: to, useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.7 }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, tabWidth, reduceMotion]);

  function openTab(index: number) {
    const route = state.routes[index];
    if (!route) return;
    const focused = state.index === index;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  }

  function setLifted(on: boolean) {
    if (reduceMotion) {
      lift.setValue(on ? 1 : 0);
      return;
    }
    Animated.spring(lift, { toValue: on ? 1 : 0, useNativeDriver: true, damping: 14, stiffness: 260 }).start();
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Taps go to the tab buttons; a sideways slide takes over to drag the lens.
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > DRAG_SLOP && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          dragStartX.current = xForIndex(state.index);
          lastHover.current = state.index;
          setHoverIndex(state.index);
          setLifted(true);
        },
        onPanResponderMove: (_e, g) => {
          const max = xForIndex(count - 1);
          const x = Math.min(Math.max(dragStartX.current + g.dx, 0), max);
          lensX.setValue(x);
          const hover = Math.round(x / (tabWidth || 1));
          if (hover !== lastHover.current) {
            lastHover.current = hover;
            setHoverIndex(hover);
            haptics.light();
          }
        },
        onPanResponderRelease: () => {
          const target = lastHover.current ?? state.index;
          setHoverIndex(null);
          setLifted(false);
          Animated.spring(lensX, { toValue: xForIndex(target), useNativeDriver: true, damping: 18, stiffness: 240 }).start();
          openTab(target);
        },
        onPanResponderTerminate: () => {
          setHoverIndex(null);
          setLifted(false);
          Animated.spring(lensX, { toValue: xForIndex(state.index), useNativeDriver: true }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.index, tabWidth, count],
  );

  function onBarLayout(e: LayoutChangeEvent) {
    setBarWidth(e.nativeEvent.layout.width);
  }

  // While dragging, the tab under the lens is the one drawn as selected.
  const litIndex = hoverIndex ?? state.index;
  const lensScaleX = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const lensScaleY = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, 8) },
        onRootScreen ? styles.wrapFloating : styles.wrapDocked,
      ]}
    >
      <View style={styles.barShadow}>
        <View style={styles.barClip} onLayout={onBarLayout}>
          {/* The glass: frost what is behind, then a thin tint and a lit top edge. */}
          <BlurView
            intensity={isDark ? 45 : 60}
            tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            blurMethod="none"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.glassTint} />
          <View pointerEvents="none" style={styles.glassSheen} />

          {/* The orange lens that marks the selected tab, and that people can drag. */}
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lens,
                {
                  width: tabWidth - LENS_INSET * 2,
                  transform: [{ translateX: Animated.add(lensX, LENS_INSET) }, { scaleX: lensScaleX }, { scaleY: lensScaleY }],
                },
              ]}
            >
              <View style={styles.lensSheen} />
            </Animated.View>
          ) : null}

          <View style={styles.row} {...pan.panHandlers}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              // One route name for both roles' merged Requests+Jobs tab (so
              // jobs/:jobId links work for either), labelled for each role.
              const labelKey =
                route.name === 'ActivityTab' && role === 'provider' ? 'tab.work' : routeLabelKeys[route.name];
              const label = labelKey ? t(labelKey) : ((options.tabBarLabel ?? options.title ?? route.name) as string);
              const focused = state.index === index;
              const lit = litIndex === index;
              const Icon = routeIcons[route.name] ?? House;
              const tint = lit ? colors.white : isDark ? 'rgba(255,255,255,0.72)' : colors.inkMuted;

              return (
                <Pressable
                  key={route.key}
                  onPress={() => openTab(index)}
                  style={({ pressed }) => [styles.item, pressed && !lit && styles.itemPressed]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={label}
                  accessibilityHint={index === 0 ? 'Slide along the bar to move between tabs' : undefined}
                >
                  <View>
                    <Icon size={ICON_SIZE} strokeWidth={lit ? 2.4 : 1.9} color={tint} />
                    {(badgeCounts[route.name] ?? 0) > 0 ? (
                      <View
                        style={[styles.badge, { backgroundColor: lit ? colors.white : colors.active }]}
                        accessibilityLabel={`${badgeCounts[route.name]} unread`}
                      />
                    ) : null}
                  </View>
                  <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 8 },
    // Over a tab's main screen: no background, the content shows through the glass.
    wrapFloating: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
    // Deeper screens: sits under the content on the page colour, as before.
    wrapDocked: { backgroundColor: colors.paper },
    barShadow: {
      borderRadius: 32,
      shadowColor: colors.black,
      shadowOpacity: isDark ? 0.4 : 0.14,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 8 },
      elevation: 14,
      // Android draws elevation shadows only on a view with a background.
      backgroundColor: Platform.OS === 'android' ? (isDark ? 'rgba(20,20,20,0.01)' : 'rgba(255,255,255,0.01)') : undefined,
    },
    barClip: {
      height: TAB_BAR_HEIGHT,
      borderRadius: 32,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.85)',
    },
    // iOS already blurs; Android (no blur) needs a stronger tint to stay legible.
    glassTint: {
      ...StyleSheet.absoluteFill,
      backgroundColor: isDark
        ? Platform.OS === 'android' ? 'rgba(28,28,30,0.82)' : 'rgba(28,28,30,0.35)'
        : Platform.OS === 'android' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.38)',
    },
    // A soft highlight across the top half, like light catching curved glass.
    glassSheen: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: TAB_BAR_HEIGHT / 2,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.35)',
    },
    lens: {
      position: 'absolute',
      top: LENS_INSET,
      left: 0,
      height: TAB_BAR_HEIGHT - LENS_INSET * 2,
      borderRadius: (TAB_BAR_HEIGHT - LENS_INSET * 2) / 2,
      backgroundColor: colors.active,
      opacity: 0.94,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
      overflow: 'hidden',
      shadowColor: colors.active,
      shadowOpacity: 0.45,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    // The lens's own highlight, so it reads as a glass drop rather than a flat pill.
    lensSheen: {
      position: 'absolute',
      left: 6,
      right: 6,
      top: 2,
      height: '45%',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.28)',
    },
    row: { flexDirection: 'row', alignItems: 'center', height: '100%' },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 1,
    },
    itemPressed: { opacity: 0.6 },
    label: {
      fontSize: fontSizes.xs,
      lineHeight: 16,
      fontFamily: fonts.semibold,
      letterSpacing: 0.2,
      textAlign: 'center',
    },
    badge: {
      position: 'absolute',
      top: -1,
      right: -3,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
}
