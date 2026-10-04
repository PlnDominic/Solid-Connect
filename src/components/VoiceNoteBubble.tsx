import { useEffect } from 'react';
import { Pause, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const BARS = [6, 12, 18, 10, 16, 22, 14, 8, 20, 15, 11, 19, 13, 7];

export function VoiceNoteBubble({
  audioUrl,
  durationSeconds,
  isMine,
}: {
  audioUrl: string;
  durationSeconds?: number | null;
  isMine: boolean;
}) {
  const { colors } = useTheme();
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  const isPlaying = Boolean(status?.playing);
  const currentTime = status?.currentTime ?? 0;
  const duration = status?.duration && status.duration > 0 ? status.duration : (durationSeconds ?? 0);
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  useEffect(() => {
    if (status?.currentTime && status?.duration && status.currentTime >= status.duration) {
      player.pause();
      player.seekTo(0);
    }
  }, [status?.currentTime, status?.duration, player]);

  function togglePlay() {
    if (isPlaying) {
      player.pause();
    } else {
      if (currentTime >= duration && duration > 0) {
        player.seekTo(0);
      }
      player.play();
    }
  }

  const fgColor = isMine ? colors.paper : colors.ink;
  const dimColor = isMine ? 'rgba(255,255,255,0.6)' : colors.inkFaint;
  const barInactive = isMine ? 'rgba(255,255,255,0.25)' : colors.hairlineStrong;
  const barActive = isMine ? colors.paper : colors.ink;

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.playBtn, { backgroundColor: isMine ? 'rgba(255,255,255,0.18)' : colors.paperDim }]}
        onPress={togglePlay}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause size={16} strokeWidth={2.4} color={fgColor} fill={fgColor} />
        ) : (
          <Play size={16} strokeWidth={2.4} color={fgColor} fill={fgColor} style={{ marginLeft: 2 }} />
        )}
      </Pressable>

      <View style={styles.rightContent}>
        {/* Waveform representation */}
        <View style={styles.waveform}>
          {BARS.map((height, i) => {
            const barFraction = i / BARS.length;
            const filled = barFraction <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: filled ? barActive : barInactive,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: dimColor }]}>
            {isPlaying ? formatDuration(currentTime) : formatDuration(duration)}
          </Text>
          <Text style={[styles.timeText, { color: dimColor }]}>Voice note</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 2,
    minWidth: 190,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContent: {
    flex: 1,
    gap: 6,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  bar: {
    width: 3,
    borderRadius: radii.pill,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.mono,
    fontVariant: ['tabular-nums'],
  },
});
