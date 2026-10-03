import { useState } from 'react';
import { ArrowUp, Mic, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { haptics } from '../lib/haptics';
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function VoiceNoteRecorder({
  onFinishRecording,
  disabled,
}: {
  onFinishRecording: (result: { uri: string; durationSeconds: number }) => Promise<void>;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);

  const durationSec = Math.max(0, Math.floor(state.durationMillis / 1000));

  async function handleStart() {
    if (disabled || busy) return;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone permission needed',
          'Allow microphone access in device settings to record voice notes.',
        );
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      haptics.selection();
    } catch {
      Alert.alert('Could not start recording', 'Please try again.');
    }
  }

  async function handleCancel() {
    if (!state.isRecording || busy) return;
    setBusy(true);
    try {
      await recorder.stop();
      haptics.light();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!state.isRecording || busy) return;
    if (durationSec < 1) {
      Alert.alert('Recording too short', 'Hold or speak for at least 1 second to send a voice note.');
      handleCancel();
      return;
    }

    setBusy(true);
    try {
      await recorder.stop();
      haptics.success();
      const uri = recorder.uri;
      if (uri) {
        await onFinishRecording({ uri, durationSeconds: Math.max(1, durationSec) });
      }
    } catch {
      Alert.alert("Couldn't send voice note", 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (state.isRecording) {
    return (
      <View style={[styles.recordingBar, { backgroundColor: colors.paperDim, borderColor: colors.hairline }]}>
        <Pressable
          style={styles.cancelBtn}
          onPress={handleCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel recording"
        >
          <Trash2 size={18} strokeWidth={2} color={colors.danger} />
        </Pressable>

        <View style={styles.recordingMeta}>
          <View style={[styles.redDot, { backgroundColor: colors.danger }]} />
          <Text style={[styles.durationText, { color: colors.ink }]}>{formatDuration(durationSec)}</Text>
          <Text style={[styles.statusText, { color: colors.inkFaint }]}>Recording...</Text>
        </View>

        <Pressable
          style={[styles.sendBtn, { backgroundColor: colors.ink }]}
          onPress={handleSend}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Send voice note"
        >
          <ArrowUp size={18} strokeWidth={2.4} color={colors.paper} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.micBtn, pressed && { opacity: 0.7 }]}
      onPress={handleStart}
      disabled={disabled || busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Record voice note"
    >
      <Mic size={20} strokeWidth={2.2} color={colors.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  micBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    gap: spacing.md,
  },
  cancelBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
  },
  durationText: {
    fontSize: 14,
    fontFamily: fonts.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
