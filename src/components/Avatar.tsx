import { Image, View, Text, StyleSheet } from 'react-native';
import { fonts } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Circular frame for initials/photo avatars. Every call site used to
 * decide for itself whether to render an <Image> or fall back to this
 * component (see FeedScreen, ProviderDetailScreen) - `photoUrl` folds
 * that same fallback in here once, so any Avatar call becomes a real
 * photo the moment the profile behind it has one.
 */
export function Avatar({
  initials,
  photoUrl,
  size = 48,
  bg,
  fg,
  dim = false,
}: {
  initials: string;
  photoUrl?: string | null;
  size?: number;
  bg?: string;
  fg?: string;
  dim?: boolean;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const resolvedBg = bg ?? colors.paperDim;
  const resolvedFg = fg ?? colors.ink;
  const frameStyle = [
    styles.frame,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: dim ? 'rgba(255,255,255,0.15)' : resolvedBg,
      borderColor: dim ? 'rgba(255,255,255,0.2)' : colors.hairline,
    },
  ];
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={frameStyle} />;
  }
  return (
    <View style={frameStyle}>
      <Text style={{ color: resolvedFg, fontFamily: fonts.extrabold, fontSize: size * 0.32 }}>{initials}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderWidth: 1, overflow: 'hidden' },
});
}
