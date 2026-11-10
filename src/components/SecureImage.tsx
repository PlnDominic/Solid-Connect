import { Image, View, type ImageProps, type ImageStyle, type StyleProp } from 'react-native';
import { useSignedUrl } from '../lib/storageUrls';
import { useTheme } from '../theme/ThemeProvider';

/** An image stored in a private bucket (chat and request photos). Fetches a
 * signed link first; shows an empty placeholder of the same size meanwhile.
 * Works unchanged for ordinary URLs. */
export function SecureImage({
  uri,
  style,
  ...rest
}: Omit<ImageProps, 'source' | 'style'> & { uri: string | null | undefined; style?: StyleProp<ImageStyle> }) {
  const { colors } = useTheme();
  const signed = useSignedUrl(uri);
  if (!signed) {
    return <View style={[{ backgroundColor: colors.paperDim }, style as object]} />;
  }
  return <Image {...rest} source={{ uri: signed }} style={style} />;
}
