import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { House, LayoutGrid, ClipboardList, Briefcase, Map as MapIcon, MessageCircle, User } from 'lucide-react-native';
import { useLocale, type TranslationKey } from '../i18n';
import { fonts } from '../theme';
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

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const styles = makeStyles(colors);
  const badgeCounts = useTabBadges();
  const role = useSessionStore((st) => st.profile?.role ?? 'customer');
  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // One route name for both roles' merged Requests+Jobs tab (so
          // jobs/:jobId links work for either), labelled for each role.
          const labelKey =
            route.name === 'ActivityTab' && role === 'provider' ? 'tab.work' : routeLabelKeys[route.name];
          const label = labelKey ? t(labelKey) : ((options.tabBarLabel ?? options.title ?? route.name) as string);
          const focused = state.index === index;
          const Icon = routeIcons[route.name] ?? House;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
            >
              {focused && <View style={styles.activePill} />}
              <View>
                <Icon
                  size={ICON_SIZE}
                  strokeWidth={focused ? 2.4 : 1.8}
                  color={focused ? colors.white : colors.textDim}
                />
                {(badgeCounts[route.name] ?? 0) > 0 ? (
                  <View
                    style={[styles.badge, { backgroundColor: focused ? colors.white : colors.ink }]}
                    accessibilityLabel={`${badgeCounts[route.name]} unread`}
                  />
                ) : null}
              </View>
              <Text
                style={[styles.label, { color: focused ? colors.white : colors.textDim }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.paper,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 2,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.card,
      shadowColor: colors.black,
      shadowOpacity: 0.07,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 12,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: 1,
    },
    itemPressed: {
      opacity: 0.5,
    },
    activePill: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.active,
      borderRadius: 28,
      margin: 4,
    },
    label: {
      fontSize: 10,
      lineHeight: 13,
      fontFamily: fonts.semibold,
      letterSpacing: 0.2,
      zIndex: 1,
      textAlign: 'center',
    },
    badge: {
      position: 'absolute',
      top: -1,
      right: -3,
      width: 8,
      height: 8,
      borderRadius: 4,
      zIndex: 2,
    },
  });
}
