import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, CheckCheck, ChevronLeft, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useMarkThreadRead, useMessages, useSendMessage, uploadChatPhoto } from '../../api/chat';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { Screen } from '../../components/Screen';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function ChatThreadScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { threadId, peerId } = route.params;
  const profile = useSessionStore((s) => s.profile);
  const { data: peer } = useProvider(peerId);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(threadId);
  const sendMessage = useSendMessage();
  const markRead = useMarkThreadRead();
  const { peerTyping, notifyTyping } = useTypingIndicator(threadId, profile?.id);
  const [text, setText] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Mark as read once on opening the thread, and again whenever a new
  // message arrives while it's already open - both are cheap, idempotent
  // no-ops server-side if nothing is actually unread (see
  // mark_thread_read's own filter on read_at is null).
  useEffect(() => {
    if (threadId && profile?.id) markRead.mutate({ threadId, readerId: profile.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, profile?.id, messages.length]);

  async function handleSend() {
    if (!text.trim() || !profile) return;
    const value = text.trim();
    setText('');
    await sendMessage.mutateAsync({ threadId, senderId: profile.id, senderRole: profile.role, text: value });
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }

  async function handlePickPhoto() {
    if (!profile) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to send a photo in chat.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const imageUrl = await uploadChatPhoto(profile.id, result.assets[0].uri);
      await sendMessage.mutateAsync({ threadId, senderId: profile.id, senderRole: profile.role, imageUrl });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      Alert.alert("Couldn't send photo", 'Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={20} strokeWidth={2.4} color={colors.ink} />
        </Pressable>
        <Avatar initials={peer?.initials ?? ''} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.peerName} numberOfLines={1}>{peer?.full_name}</Text>
          {peerTyping ? <Text style={styles.typingLabel}>typing…</Text> : null}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            messagesLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.inkFaint, fontFamily: fonts.medium, fontSize: 13.5 }}>
                  Say hello 👋
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id;
            return (
              <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, item.image_url && styles.bubbleImageWrap]}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.bubbleImage} resizeMode="cover" />
                  ) : null}
                  {item.text ? (
                    <Text style={[mine ? styles.bubbleTextMine : styles.bubbleTextTheirs, item.image_url && { marginTop: spacing.sm }]}>
                      {item.text}
                    </Text>
                  ) : null}
                  {mine ? (
                    <View style={styles.receiptRow}>
                      {item.read_at ? (
                        <CheckCheck size={12} strokeWidth={2.4} color={colors.confirm} />
                      ) : (
                        <Check size={12} strokeWidth={2.4} color="rgba(255,255,255,0.55)" />
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
        <View style={styles.inputRow}>
          <Pressable
            style={styles.photoBtn}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Send a photo"
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.inkFaint} />
            ) : (
              <ImagePlus size={20} strokeWidth={2} color={colors.inkFaint} />
            )}
          </Pressable>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              notifyTyping();
            }}
            placeholder="Message"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            onSubmitEditing={handleSend}
          />
          <Pressable
            style={styles.sendBtn}
            onPress={handleSend}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <ArrowUp size={18} strokeWidth={2.4} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairline,
    },
    back: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
    },
    peerName: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
    typingLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.confirm, marginTop: 1 },

    bubble: {
      maxWidth: '78%',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radii.lg,
      gap: 2,
    },
    bubbleImageWrap: { padding: 6 },
    bubbleImage: { width: 200, height: 200, borderRadius: radii.md },
    bubbleMine: { backgroundColor: colors.ink, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: colors.paperDim, borderBottomLeftRadius: 4 },
    bubbleTextMine: { color: colors.white, fontFamily: fonts.medium, fontSize: 15 },
    bubbleTextTheirs: { color: colors.ink, fontFamily: fonts.medium, fontSize: 15 },
    receiptRow: { alignSelf: 'flex-end', marginTop: 2 },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
    },
    photoBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
    },
    input: {
      flex: 1,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.paperDim,
      paddingHorizontal: spacing.lg,
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.ink,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.ink,
    },
  });
}
