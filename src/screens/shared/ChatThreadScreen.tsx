import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useMessages, useSendMessage } from '../../api/chat';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

export function ChatThreadScreen({ navigation, route }: { navigation: any; route: any }) {
  const { threadId, peerId } = route.params;
  const profile = useSessionStore((s) => s.profile);
  const { data: peer } = useProvider(peerId);
  const { data: messages = [] } = useMessages(threadId);
  const sendMessage = useSendMessage();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  async function handleSend() {
    if (!text.trim() || !profile) return;
    const value = text.trim();
    setText('');
    await sendMessage.mutateAsync({ threadId, senderId: profile.id, senderRole: profile.role, text: value });
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.chevron}>‹</Text>
        </Pressable>
        <Avatar initials={peer?.initials ?? ''} size={36} />
        <Text style={styles.peerName}>{peer?.full_name}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id;
            return (
              <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[styles.bubble, { backgroundColor: mine ? colors.ink : colors.tile }]}>
                  <Text style={{ color: mine ? colors.white : colors.textHeading, fontSize: 14, lineHeight: 19 }}>
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }}
        />
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            onSubmitEditing={handleSend}
          />
          <Pressable style={styles.sendBtn} onPress={handleSend}>
            <Text style={{ color: colors.white, fontSize: 16 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.card,
  },
  chevron: { fontSize: 20, color: colors.ink },
  peerName: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  bubble: { maxWidth: '76%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.xxl },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
