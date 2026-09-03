import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLatestMessage, useThreadsForRole } from '../../api/chat';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, spacing } from '../../theme';
import type { ChatThread } from '../../types/database';

function ThreadRow({ thread, myRole, onPress }: { thread: ChatThread; myRole: 'customer' | 'provider'; onPress: () => void }) {
  const peerId = myRole === 'customer' ? thread.provider_id : thread.customer_id;
  const { data: peer } = useProvider(peerId);
  const { data: latest } = useLatestMessage(thread.id);

  if (!peer) return null;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar initials={peer.initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name}>{peer.full_name}</Text>
        <Text style={styles.preview} numberOfLines={1}>
          {latest?.text ?? 'Say hello 👋'}
        </Text>
      </View>
      {latest ? <Text style={styles.time}>{formatTime(latest.created_at)}</Text> : null}
    </Pressable>
  );
}

export function ChatListScreen({ navigation, role }: { navigation: any; role: 'customer' | 'provider' }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: threads = [] } = useThreadsForRole(profile?.id ?? null, role);

  return (
    <Screen>
      <ScreenHeader title="Chat" large />
      <ScrollView>
        {threads.length ? (
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  name: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  preview: { fontSize: 13, color: colors.textFaint },
  time: { fontSize: 12, color: colors.textFaint },
});
