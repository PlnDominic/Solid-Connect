import { useRef, useState } from 'react';
import { ArrowUp, ChevronLeft } from 'lucide-react-native';
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
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
        </Pressable>
        <Avatar initials={peer?.initials ?? ''} size={36} />
        <Text style={styles.peerName}>{peer?.full_name}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id;
            return (
              <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text>
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
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            onSubmitEditing={handleSend}
          />
          <Pressable style={styles.sendBtn} onPress={handleSend}>
            <ArrowUp size={18} strokeWidth={2.4} color={colors.white} />
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
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.card,
  },
  back: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperDim,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  peerName: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },

  bubble: { maxWidth: '76%', paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radii.xxl },
  bubbleMine: { backgroundColor: colors.ink },
  bubbleTheirs: { backgroundColor: colors.paperDim, borderWidth: 1, borderColor: colors.hairline },
  bubbleTextMine: { color: colors.white, fontSize: 14, lineHeight: 19, fontFamily: fonts.regular },
  bubbleTextTheirs: { color: colors.ink, fontSize: 14, lineHeight: 19, fontFamily: fonts.regular },

  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  sendBtn: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
