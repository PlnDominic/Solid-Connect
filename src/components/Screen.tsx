import { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Common screen wrapper: safe-area padding, background, and a status-bar
 * style matched to the surface (dark header -> light status-bar icons).
 */
export function Screen({
  children,
  dark = false,
  bg,
  edges = ['top'],
  style,
}: {
  children?: ReactNode;
  dark?: boolean;
  bg?: string;
  edges?: Edge[];
  style?: ViewStyle;
}) {
  const { colors, scheme } = useTheme();
  const background = dark ? colors.ink : bg ?? colors.paper;
  const statusStyle = dark || scheme === 'dark' ? 'light' : 'dark';
  return (
    <View style={[styles.fill, { backgroundColor: background }]}>
      <StatusBar style={statusStyle} />
      <SafeAreaView edges={edges} style={[styles.fill, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
