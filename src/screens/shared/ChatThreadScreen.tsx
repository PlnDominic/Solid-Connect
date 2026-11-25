import { useEffect, useRef, useState } from 'react';
import { SecureImage } from '../../components/SecureImage';
import { ArrowUp, Check, CheckCheck, ChevronLeft, ImagePlus, MoreVertical, Phone } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ContactDetailsBlockedError,
  useHasActiveJobWith,
  useMarkThreadRead,
  useMessages,
  useSendMessage,
  uploadChatPhoto,
  uploadChatAudio,
} from '../../api/chat';
import { CONTACT_DETAILS_TITLE } from '../../lib/contactDetails';
import { useProvider } from '../../api/marketplace';
import { friendlySafetyError, useBlockUser, useMyBlocks, useUnblockUser } from '../../api/safety';
import { Avatar } from '../../components/Avatar';
import { ReportSheet } from '../../components/ReportSheet';
import { Screen } from '../../components/Screen';
import { VoiceNoteBubble } from '../../components/VoiceNoteBubble';
import { VoiceNoteRecorder } from '../../components/VoiceNoteRecorder';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import { haptics } from '../../lib/haptics';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useContactPhone } from '../../api/profileColumns';

export function ChatThreadScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { threadId, peerId } = route.params;
  const profile = useSessionStore((s) => s.profile);
  const { data: peer } = useProvider(peerId);
  const { data: messages = [], isLoading: messagesLoading, isError: messagesError, refetch: refetchMessages } = useMessages(threadId);
  const sendMessage = useSendMessage();
  const markRead = useMarkThreadRead();
  const { data: hasActiveJob = false } = useHasActiveJobWith(profile?.id, peerId, profile?.role);
  const { data: peerPhone } = useContactPhone(peerId, hasActiveJob);
  const { peerTyping, notifyTyping } = useTypingIndicator(threadId, profile?.id);
  const [text, setText] = useState('');
  const [failedMessages, setFailedMessages] = useState<{ id: number; text: string; blocked: boolean }[]>([]);
  const nextFailedId = useRef(0);
  const sendingText = useRef(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { data: blocks = [] } = useMyBlocks(profile?.id);
  const blockUser = useBlockUser(profile?.id);
  const unblockUser = useUnblockUser(profile?.id);
  const iBlockedThem = blocks.some((b) => b.blocked_id === peerId);
  const listRef = useRef<FlatList>(null);

  // Mark as read once on opening the thread, and again whenever a new
  // message arrives while it's already open - both are cheap, idempotent
  // no-ops server-side if nothing is actually unread (see
  // mark_thread_read's own filter on read_at is null).
  useEffect(() => {
    if (threadId && profile?.id) markRead.mutate({ threadId, readerId: profile.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, profile?.id, messages.length]);

  async function sendText(value: string, id?: number) {
    if (!profile || sendMessage.isPending || sendingText.current) return;
    sendingText.current = true;
    try {
      await sendMessage.mutateAsync({ threadId, senderId: profile.id, senderRole: profile.role, text: value });
      if (id !== undefined) setFailedMessages((messages) => messages.filter((message) => message.id !== id));
      haptics.light();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      const blocked = err instanceof ContactDetailsBlockedError;
      if (id === undefined) {
        const failedId = nextFailedId.current++;
        setFailedMessages((messages) => [...messages, { id: failedId, text: value, blocked }]);
      } else if (blocked) {
        setFailedMessages((messages) => messages.map((message) => message.id === id ? { ...message, blocked } : message));
      }
      if (err instanceof ContactDetailsBlockedError) {
        haptics.warning();
        Alert.alert(CONTACT_DETAILS_TITLE[err.kind], err.message);
        return;
      }
      Alert.alert('Message not sent', friendlySafetyError(err));
    } finally {
      sendingText.current = false;
    }
  }

  function handleSend() {
    if (!text.trim() || !profile || sendMessage.isPending || sendingText.current) return;
    const value = text.trim();
    setText('');
    void sendText(value);
  }

  function openMenu() {
    const name = peer?.full_name ?? 'this person';
    Alert.alert(name, undefined, [
      { text: 'Report', onPress: () => setReporting(true) },
      iBlockedThem
        ? { text: 'Unblock', onPress: () => unblockUser.mutate(peerId) }
        : {
            text: 'Block',
            style: 'destructive',
            onPress: () =>
              Alert.alert(`Block ${name}?`, 'You will not be able to message each other. You can unblock later in Profile.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: () => blockUser.mutate(peerId) },
              ]),
          },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleCallPeer() {
    if (!peer || !peerPhone) {
      Alert.alert('Phone number unavailable', 'This user does not have a phone number on file.');
      return;
    }
    const name = peer.full_name || 'this contact';
    Alert.alert(
      `Call ${name}?`,
      `Dial ${peerPhone} to coordinate directly. Standard cellular rates apply.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            const cleaned = peerPhone.replace(/[^\d+]/g, '');
            Linking.openURL(`tel:${cleaned}`).catch(() => {
              Alert.alert('Could not dial', 'Your device could not open the phone dialer.');
            });
          },
        },
      ],
    );
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
    // This screen's own provider: its bottom inset includes the iOS tab bar,
    // which the app-wide provider does not see, so the composer sits above it.
    <SafeAreaProvider>
    <Screen edges={['top', 'bottom']}>
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
        <Avatar initials={peer?.initials ?? ''} photoUrl={peer?.photo_url} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.peerName} numberOfLines={1}>{peer?.full_name}</Text>
          {peerTyping ? <Text style={styles.typingLabel}>typing…</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Calling is only offered once a job is booked between them. */}
          {peer && peerPhone && hasActiveJob ? (
            <Pressable
              onPress={handleCallPeer}
              hitSlop={12}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel={`Call ${peer.full_name}`}
            >
              <Phone size={17} strokeWidth={2.2} color={colors.ink} />
            </Pressable>
          ) : null}
          <Pressable onPress={openMenu} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Report or block">
            <MoreVertical size={18} strokeWidth={2.2} color={colors.ink} />
          </Pressable>
        </View>
      </View>
      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        reportedId={peerId}
        reportedName={peer?.full_name}
        context="chat"
        threadId={threadId}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            // Solid Connect holds no money: the two sides settle directly.
            <Text
              style={{
                alignSelf: 'center',
                textAlign: 'center',
                maxWidth: 300,
                marginBottom: spacing.sm,
                color: colors.inkFaint,
                fontFamily: fonts.medium,
                fontSize: fontSizes.xs,
                lineHeight: 17,
              }}
            >
              Pay your provider directly once the work is done. Solid Connect does not take payment, so never pay in advance for work that has not started.
            </Text>
          }
          ListEmptyComponent={
            messagesLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : messagesError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetchMessages()}
                style={{ alignSelf: 'center', padding: spacing.md }}
              >
                <Text style={{ color: colors.ink, fontFamily: fonts.medium }}>
                  Could not load messages. Tap to retry.
                </Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.inkFaint, fontFamily: fonts.medium, fontSize: fontSizes.sm }}>
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
                    <SecureImage uri={item.image_url} style={styles.bubbleImage} resizeMode="cover" />
                  ) : null}
                  {item.audio_url ? (
                    <VoiceNoteBubble
                      audioUrl={item.audio_url}
                      durationSeconds={item.audio_duration_seconds}
                      isMine={mine}
                    />
                  ) : null}
                  {item.text ? (
                    <Text
                      style={[
                        mine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
                        (item.image_url || item.audio_url) && { marginTop: spacing.sm },
                      ]}
                    >
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
        {!iBlockedThem && failedMessages.length > 0 ? (
          <ScrollView style={{ maxHeight: 160, flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            {failedMessages.map((message) => (
              <View key={message.id} style={{ padding: spacing.sm, gap: spacing.xs }}>
                <Text style={{ color: colors.danger, fontFamily: fonts.semibold }}>Not sent</Text>
                <Text style={{ color: colors.ink }} numberOfLines={2}>{message.text}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                  {!message.blocked ? (
                    <Pressable onPress={() => void sendText(message.text, message.id)} disabled={sendMessage.isPending} accessibilityRole="button">
                      <Text style={{ color: colors.ink }}>Retry</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      setText((draft) => draft ? `${draft}\n${message.text}` : message.text);
                      setFailedMessages((messages) => messages.filter((item) => item.id !== message.id));
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: colors.ink }}>Edit in composer</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFailedMessages((messages) => messages.filter((item) => item.id !== message.id))}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: colors.inkMuted }}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {iBlockedThem ? (
          <View style={styles.inputRow}>
            <Text style={[styles.typingLabel, { flex: 1, color: colors.inkMuted }]}>You blocked this person.</Text>
            <Pressable onPress={() => unblockUser.mutate(peerId)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.peerName, { fontSize: fontSizes.sm }]}>Unblock</Text>
            </Pressable>
          </View>
        ) : (
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
          {text.trim().length > 0 ? (
            <Pressable
              style={styles.sendBtn}
              onPress={handleSend}
              disabled={sendMessage.isPending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <ArrowUp size={18} strokeWidth={2.4} color={colors.white} />
            </Pressable>
          ) : (
            <VoiceNoteRecorder
              onFinishRecording={async ({ uri, durationSeconds }) => {
                if (!profile) return;
                try {
                  const audioUrl = await uploadChatAudio(profile.id, uri);
                  await sendMessage.mutateAsync({
                    threadId,
                    senderId: profile.id,
                    senderRole: profile.role,
                    audioUrl,
                    audioDurationSeconds: durationSeconds,
                  });
                  requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
                } catch {
                  Alert.alert("Couldn't send voice note", 'Please try again.');
                }
              }}
              disabled={uploadingPhoto || sendMessage.isPending}
            />
          )}
        </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
    </SafeAreaProvider>
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
    peerName: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    typingLabel: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.confirm, marginTop: 1 },

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
    bubbleTextMine: { color: colors.white, fontFamily: fonts.medium, fontSize: fontSizes.md },
    bubbleTextTheirs: { color: colors.ink, fontFamily: fonts.medium, fontSize: fontSizes.md },
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
      fontSize: fontSizes.md,
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
