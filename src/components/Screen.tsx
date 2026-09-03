import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from '../theme';

/**
 * Common screen wrapper: safe-area padding, background, and a status-bar
 * style matched to the surface (dark header -> light status-bar icons).
 */
export function Screen({
  children,
  dark = false,
  bg = colors.paper,
  edges = ['top'],
  style,
}: {
  children?: ReactNode;
  dark?: boolean;
  bg?: string;
  edges?: Edge[];
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.fill, { backgroundColor: dark ? colors.ink : bg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <SafeAreaView edges={edges} style={[styles.fill, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
