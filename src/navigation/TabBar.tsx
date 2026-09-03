import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { House, LayoutGrid, ClipboardList, Briefcase, MessageCircle, User } from 'lucide-react-native';
import { colors, fonts } from '../theme';

const routeIcons: Record<string, LucideIcon> = {
  HomeTab: House,
  FeedTab: LayoutGrid,
  RequestsTab: ClipboardList,
  JobsTab: Briefcase,
  ChatTab: MessageCircle,
  ProfileTab: User,
};

const ICON_SIZE = 22;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
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
              <Icon
                size={ICON_SIZE}
                strokeWidth={focused ? 2.4 : 1.8}
                color={focused ? colors.white : colors.textDim}
              />
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

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
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
});
