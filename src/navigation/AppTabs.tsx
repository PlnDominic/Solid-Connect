import type { ComponentType } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useLocale } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { useSessionStore } from '../store/useSessionStore';
import { TabBar, routeLabelKeys, useTabBadges } from './TabBar';

/**
 * The app's bottom tabs.
 *
 * iOS uses the system tab bar (UITabBarController through react-native-screens).
 * On iOS 26 and later that bar is real Liquid Glass: it refracts and tints
 * itself from the content scrolling behind it, the selection is a glass lens
 * the user can press and drag across the tabs, and the bar shrinks on scroll.
 * On iOS 18 and earlier the same bar falls back to the standard blurred
 * material on its own, so no availability check is needed here.
 *
 * Liquid Glass is an Apple material, so Android and web keep the JS tab bar
 * in TabBar.tsx (native tabs throw on web, and Android needs bitmap icons).
 */
const isIOS = process.env.EXPO_OS === 'ios';

// Created only where it is supported: the web build of the native navigator throws.
const NativeTab = isIOS ? createNativeBottomTabNavigator() : null;
const JsTab = createBottomTabNavigator();

/** SF Symbols per tab route: outline when idle, filled when selected (HIG). */
const routeSymbols: Record<string, { idle: SFSymbol; selected: SFSymbol }> = {
  HomeTab: { idle: 'house', selected: 'house.fill' },
  FeedTab: { idle: 'square.grid.2x2', selected: 'square.grid.2x2.fill' },
  MapTab: { idle: 'map', selected: 'map.fill' },
  ActivityTab: { idle: 'list.clipboard', selected: 'list.clipboard.fill' },
  ChatTab: { idle: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' },
  ProfileTab: { idle: 'person.crop.circle', selected: 'person.crop.circle.fill' },
};

export type TabSpec = {
  name: string;
  component: ComponentType<any>;
};

export function AppTabs({ tabs }: { tabs: TabSpec[] }) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const badges = useTabBadges();
  const role = useSessionStore((s) => s.profile?.role ?? 'customer');

  const labelFor = (name: string) => {
    const key = name === 'ActivityTab' && role === 'provider' ? 'tab.work' : routeLabelKeys[name];
    return key ? t(key) : name;
  };

  if (NativeTab) {
    return (
      <NativeTab.Navigator
        screenOptions={{
          headerShown: false,
          // Brand orange tints the selected icon and label; the glass itself stays clear.
          tabBarActiveTintColor: colors.active,
          // The bar collapses to a small glass pill while the user scrolls down.
          tabBarMinimizeBehavior: 'onScrollDown',
          // Root screens already pad their scroll content for the bar (useTabBarClearance).
          overrideScrollViewContentInsetAdjustmentBehavior: false,
        }}
      >
        {tabs.map((tab) => {
          const symbols = routeSymbols[tab.name];
          const badge = badges[tab.name] ?? 0;
          return (
            <NativeTab.Screen
              key={tab.name}
              name={tab.name}
              component={tab.component}
              options={{
                tabBarLabel: labelFor(tab.name),
                tabBarIcon: symbols
                  ? ({ focused }) => ({ type: 'sfSymbol', name: focused ? symbols.selected : symbols.idle })
                  : undefined,
                tabBarBadge: badge > 0 ? (badge > 99 ? '99+' : badge) : undefined,
                tabBarBadgeStyle: { backgroundColor: colors.active },
              }}
            />
          );
        })}
      </NativeTab.Navigator>
    );
  }

  return (
    <JsTab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {tabs.map((tab) => (
        <JsTab.Screen key={tab.name} name={tab.name} component={tab.component} options={{ tabBarLabel: labelFor(tab.name) }} />
      ))}
    </JsTab.Navigator>
  );
}
