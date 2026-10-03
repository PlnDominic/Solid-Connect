import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Shared image compression for every user-picked upload (request photos,
 * profile photo, portfolio, verification docs, chat photos). Phone cameras
 * produce 3-8 MB originals; this normalizes them to a bounded JPEG so
 * uploads stay fast and cheap on Ghanaian mobile data - PRODUCT.md names
 * resilience to slow networks a baseline expectation.
 *
 * Uses the SDK 52+ contextual ImageManipulator API (the old
 * manipulateAsync is deprecated): load context → resize → render → save.
 */

/** Max longest edge in px. 1600 is plenty for a phone screen and ~4x the doc-photo floor. */
const MAX_EDGE = 1600;

/** JPEG quality 0-1. 0.72 is visually indistinguishable for job photos. */
const COMPRESS = 0.72;

/**
 * Compresses and resizes one image URI, returning a new local file URI.
 * Falls back to the original URI if manipulation fails (e.g. unsupported
 * format) - an uncompressed upload beats a broken one.
 */
export async function compressImage(imageUri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(imageUri);
    const rendered = await context.renderAsync();
    const needsResize = rendered.width > MAX_EDGE || rendered.height > MAX_EDGE;
    if (needsResize) {
      const scale = MAX_EDGE / Math.max(rendered.width, rendered.height);
      context.reset().resize({
        width: Math.round(rendered.width * scale),
        height: Math.round(rendered.height * scale),
      });
    }
    const finalRef = needsResize
      ? await context.renderAsync()
      : rendered;
    const saved = await finalRef.saveAsync({
      compress: COMPRESS,
      format: SaveFormat.JPEG,
    });
    return saved.uri;
  } catch {
    return imageUri;
  }
}
