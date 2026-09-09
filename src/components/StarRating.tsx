import { Star } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** Read-only star row in the receipt aesthetic: filled stars are ink, never decorative gold. */
export function StarRating({ value, size = 12, gap = 2 }: { value: number; size?: number; gap?: number }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.row, { gap }]}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={2} color={n <= Math.round(value) ? colors.ink : colors.hairlineStrong} fill={n <= Math.round(value) ? colors.ink : 'transparent'} />
      ))}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
  });
}
