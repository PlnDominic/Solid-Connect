import { Star } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** Read-only star row: filled stars use the brand orange, like every other rating in the app. */
export function StarRating({ value, size = 12, gap = 2 }: { value: number; size?: number; gap?: number }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.row, { gap }]}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={2} color={n <= Math.round(value) ? colors.active : colors.hairlineStrong} fill={n <= Math.round(value) ? colors.active : 'transparent'} />
      ))}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
  });
}
