import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { fonts, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Global connectivity glue, mounted once in App:
 * - Keeps TanStack Query's onlineManager in sync with NetInfo so queries
 *   pause while offline instead of hammering a dead network (retry: 1 would
 *   otherwise burn through retries on every screen).
 * - On reconnect: resumes mutations that queued while offline, then
 *   invalidates everything so stale screens refetch fresh data.
 * - Renders a slim banner at the top of the screen while offline.
 */
export function OfflineBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected ?? true;
  const wasOnline = useRef(true);

  useEffect(() => {
    onlineManager.setOnline(isConnected);
  }, [isConnected]);

  useEffect(() => {
    if (isConnected && !wasOnline.current) {
      // Back online: flush queued mutations first (they carry user intent -
      // sent messages, quotes), then refetch every cached query.
      queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
    }
    wasOnline.current = isConnected;
  }, [isConnected, queryClient]);

  if (isConnected) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.banner, { top: insets.top, backgroundColor: colors.ink }]}
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Showing saved data."
    >
      <Text style={[styles.text, { color: colors.paper }]}>
        You're offline - showing saved data
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
  text: { fontSize: 12.5, fontFamily: fonts.semibold },
});
