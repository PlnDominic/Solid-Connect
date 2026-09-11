import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { House, LayoutGrid, ClipboardList, Briefcase, MessageCircle, User } from 'lucide-react-native';
import { fonts } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
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
                color={focused ? colors.paper : colors.textDim}
              />
              <Text
                style={[styles.label, { color: focused ? colors.paper : colors.textDim }]}
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
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
  });
}
