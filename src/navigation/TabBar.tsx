import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fonts } from '../theme';

/** Matches the prototype's minimal tab bar: a small square + label, tinted by active state. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
          const focused = state.index === index;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.item}
            >
              <View style={[styles.dot, { backgroundColor: focused ? colors.ink : colors.textDim }]} />
              <Text style={[styles.label, { color: focused ? colors.ink : colors.textFaint }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.hairline },
  row: { flexDirection: 'row', paddingTop: 10, paddingBottom: 2, paddingHorizontal: 4 },
  item: { flex: 1, alignItems: 'center', gap: 5 },
  dot: { width: 22, height: 22, borderRadius: 7 },
  label: { fontSize: 10, fontFamily: fonts.bold },
});
