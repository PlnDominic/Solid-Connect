import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLatestMessage, useThreadsForRole } from '../../api/chat';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { ChatThread } from '../../types/database';

function ThreadRow({ thread, myRole, onPress }: { thread: ChatThread; myRole: 'customer' | 'provider'; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const peerId = myRole === 'customer' ? thread.provider_id : thread.customer_id;
  const { data: peer } = useProvider(peerId);
  const { data: latest } = useLatestMessage(thread.id);

  if (!peer) return null;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar initials={peer.initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name} numberOfLines={1}>{peer.full_name}</Text>
        <Text style={styles.preview} numberOfLines={1}>
          {latest?.text ?? 'Say hello 👋'}
        </Text>
      </View>
      {latest ? <Text style={styles.time}>{formatTime(latest.created_at)}</Text> : null}
    </Pressable>
  );
}

export function ChatListScreen({ navigation, role }: { navigation: any; role: 'customer' | 'provider' }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: threads = [], isLoading: threadsLoading, refetch } = useThreadsForRole(profile?.id ?? null, role);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  return (
    <Screen>
      <ScreenHeader title="Chat" large />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {threadsLoading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : threads.length ? (
          threads.map((t) => (
            <ThreadRow
              key={t.id}
              thread={t}
              myRole={role}
              onPress={() =>
                navigation.navigate('ChatThread', {
                  threadId: t.id,
                  peerId: role === 'customer' ? t.provider_id : t.customer_id,
                })
              }
            />
          ))
        ) : (
          <EmptyState title="No conversations yet" />
        )}
      </ScrollView>
    </Screen>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
    },
    name: { fontSize: 16.5, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.15 },
    preview: { fontSize: 14.5, fontFamily: fonts.regular, color: colors.inkMuted },
    time: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint, fontVariant: ['tabular-nums'] },
  });
}
