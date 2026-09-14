import { useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** State/open/close for ImageViewer, so a call site doesn't need its own
 * useState triple every time it wants a tap-to-zoom gallery. */
export function useImageViewer() {
  const [state, setState] = useState<{ visible: boolean; images: string[]; index: number }>({
    visible: false,
    images: [],
    index: 0,
  });
  function open(images: string[], index = 0) {
    setState({ visible: true, images, index });
  }
  function close() {
    setState((s) => ({ ...s, visible: false }));
  }
  return { ...state, open, close };
}

/**
 * Full-screen photo viewer - swipe between images, pinch to zoom one.
 * Deliberately no new dependency: RN's own ScrollView already supports
 * pinch-to-zoom natively on both platforms via maximumZoomScale, so one
 * horizontally-paging ScrollView of per-image zoomable ScrollViews covers
 * the whole feature without pulling in a gallery library. Shared by
 * portfolio photos, request photos, and chat images - anywhere a photo
 * was previously a fixed-size thumbnail with no way to actually look at
 * it closely.
 */
export function ImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(initialIndex);

  if (!images.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
        >
          {images.map((uri) => (
            <ScrollView
              key={uri}
              style={{ width: SCREEN_WIDTH }}
              contentContainerStyle={styles.page}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri }} style={styles.image} resizeMode="contain" />
            </ScrollView>
          ))}
        </ScrollView>

        <SafeAreaView style={styles.topBar} edges={['top']}>
          {images.length > 1 ? (
            <Text style={styles.counter}>{index + 1} / {images.length}</Text>
          ) : (
            <View />
          )}
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  page: { width: SCREEN_WIDTH, flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: SCREEN_WIDTH, height: '100%' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  counter: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: fonts.semibold },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
