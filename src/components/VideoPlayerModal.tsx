import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Full-screen playback for one portfolio video clip - the video
 * counterpart to ImageViewer, kept separate rather than folding video
 * support into that component, since a zoomable-image gallery and a
 * single-clip player have little in common besides both being full-screen
 * modals. useVideoPlayer is always called (never conditionally) with a
 * possibly-null source, per expo-video's own pattern for "no clip loaded
 * yet" - only the Modal's visibility is conditional.
 */
export function VideoPlayerModal({ visible, uri, onClose }: { visible: boolean; uri: string | null; onClose: () => void }) {
  const { colors } = useTheme();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (visible && uri) player.play();
    else player.pause();
  }, [visible, uri, player]);

  return (
    <Modal visible={visible && !!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {uri ? <VideoView style={styles.video} player={player} nativeControls contentFit="contain" /> : null}
        <SafeAreaView style={styles.topBar} edges={['top']}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} strokeWidth={2.4} color={colors.white} />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
