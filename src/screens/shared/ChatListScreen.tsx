import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Check, CheckCheck, Search, ShieldCheck, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useHideThread, useThreadsForRole } from '../../api/chat';
import { useProvidersByIds } from '../../api/marketplace';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { isIdentityVerified } from '../../lib/verification';
import type { ChatMessage, ChatThread, Profile } from '../../types/database';

const LIST_FILTERS: FilterOption[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
];

async function fetchLatestMessage(threadId: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type ThreadPreview = {
  thread: ChatThread;
  peer: Profile;
  latest: ChatMessage | null;
  unread: boolean;
};

function ThreadRow({
  preview,
  myId,
  onPress,
  onDelete,
}: {
  preview: ThreadPreview;
  myId: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { peer, latest, unread } = preview;
  const sentByMe = latest?.sender_id === myId;

  function handleLongPress() {
    Alert.alert(
      'Delete this chat?',
      `This removes it from your list only - ${peer.full_name} will still see your conversation. New messages bring it back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      onLongPress={handleLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${peer.full_name}`}
      accessibilityHint="Long press for options"
    >
      <Avatar initials={peer.initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>{peer.full_name}</Text>
          {isIdentityVerified(peer) ? <ShieldCheck size={13} strokeWidth={2.4} color={colors.confirm} /> : null}
        </View>
        <View style={styles.previewRow}>
          {sentByMe ? (
            latest?.read_at ? (
              <CheckCheck size={14} strokeWidth={2.2} color={colors.active} />
            ) : (
              <Check size={14} strokeWidth={2.2} color={colors.inkFaint} />
            )
          ) : null}
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {latest?.image_url && !latest.text ? 'Photo' : latest?.text ?? 'Say hello 👋'}
          </Text>
        </View>
      </View>
      <View style={styles.trailing}>
        {latest ? <Text style={styles.time}>{formatTime(latest.created_at)}</Text> : null}
        {unread ? <View style={styles.unreadDot} /> : null}
        <Pressable
          hitSlop={10}
          onPress={handleLongPress}
          accessibilityRole="button"
          accessibilityLabel={`Delete chat with ${peer.full_name}`}
        >
          <Trash2 size={14} strokeWidth={2} color={colors.inkFainter} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export function ChatListScreen({ navigation, role }: { navigation: any; role: 'customer' | 'provider' }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: threads = [], isLoading: threadsLoading, refetch } = useThreadsForRole(profile?.id ?? null, role);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);
  const hideThread = useHideThread();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const peerIds = useMemo(
    () => threads.map((t) => (role === 'customer' ? t.provider_id : t.customer_id)),
    [threads, role],
  );
  const { data: peers = [] } = useProvidersByIds(peerIds);
  const peerById = useMemo(() => new Map(peers.map((p) => [p.id, p])), [peers]);

  // One query per thread, sharing the exact key useLatestMessage uses
  // elsewhere so both read the same cache entry instead of double-fetching
  // the same row.
  const latestResults = useQueries({
    queries: threads.map((t) => ({
      queryKey: ['latestMessage', t.id],
      queryFn: () => fetchLatestMessage(t.id),
      enabled: true,
    })),
  });

  const previews: ThreadPreview[] = useMemo(() => {
    return threads
      .map((thread, i) => {
        const peerId = role === 'customer' ? thread.provider_id : thread.customer_id;
        const peer = peerById.get(peerId);
        if (!peer) return null;
        const latest = latestResults[i]?.data ?? null;
        const unread = !!latest && latest.sender_id !== profile?.id && !latest.read_at;
        return { thread, peer, latest, unread };
      })
      .filter((p): p is ThreadPreview => !!p)
      .sort((a, b) => {
        const at = a.latest?.created_at ?? a.thread.created_at;
        const bt = b.latest?.created_at ?? b.thread.created_at;
        return bt.localeCompare(at);
      });
  }, [threads, peerById, latestResults, role, profile?.id]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return previews.filter((p) => {
      if (filter === 'unread' && !p.unread) return false;
      if (!needle) return true;
      return p.peer.full_name.toLowerCase().includes(needle);
    });
  }, [previews, search, filter]);

  return (
    <Screen>
      <ScreenHeader title="Chats" large />
      <View style={styles.searchBar}>
        <Search size={16} strokeWidth={2} color={colors.inkFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={colors.inkFainter}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <View style={styles.filtersWrap}>
        <FilterChips options={LIST_FILTERS} value={filter} onChange={setFilter} />
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {threadsLoading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : visible.length ? (
          visible.map((p) => (
            <ThreadRow
              key={p.thread.id}
              preview={p}
              myId={profile?.id ?? ''}
              onPress={() =>
                navigation.navigate('ChatThread', {
                  threadId: p.thread.id,
                  peerId: role === 'customer' ? p.thread.provider_id : p.thread.customer_id,
                })
              }
              onDelete={() => hideThread.mutate({ threadId: p.thread.id, role })}
            />
          ))
        ) : threads.length ? (
          <EmptyState title="No matches" subtitle="Try a different name or filter." />
        ) : (
          <EmptyState title="No conversations yet" />
        )}
      </ScrollView>
    </Screen>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: 44,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    searchInput: { flex: 1, fontSize: 14.5, fontFamily: fonts.medium, color: colors.ink },
    filtersWrap: { paddingBottom: spacing.md },
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
      ...shadow.card,
    },
    rowPressed: { backgroundColor: colors.paperDim },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    name: { fontSize: 16.5, fontFamily: fonts.semibold, color: colors.ink, letterSpacing: -0.15, flexShrink: 1 },
    nameUnread: { fontFamily: fonts.bold },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    preview: { flex: 1, fontSize: 14.5, fontFamily: fonts.regular, color: colors.inkMuted },
    previewUnread: { fontFamily: fonts.semibold, color: colors.ink },
    trailing: { alignItems: 'flex-end', gap: 6 },
    time: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint, fontVariant: ['tabular-nums'] },
    unreadDot: { width: 9, height: 9, borderRadius: radii.pill, backgroundColor: colors.active },
  });
}
