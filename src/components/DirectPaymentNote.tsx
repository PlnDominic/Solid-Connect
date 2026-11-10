import { StyleSheet, Text, View } from 'react-native';
import { Banknote } from 'lucide-react-native';
import { fonts, fontSizes, radii, shadow, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Solid Connect never collects, holds or pays out money for a job. This card
 * says so on the job screens, so neither side expects the app to take payment.
 */
export function DirectPaymentNote({ role, price }: { role: 'customer' | 'provider'; price?: number }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.icon}>
        <Banknote size={18} strokeWidth={2.2} color={colors.active} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Pay the provider directly</Text>
        <Text style={styles.body}>
          {role === 'customer'
            ? `Agree with your provider how to pay${price ? ` the GHS ${price.toLocaleString()}` : ''}, in cash or Mobile Money, when the work is done. Solid Connect does not take or hold any payment.`
            : `Agree with the customer how you will be paid${price ? ` the GHS ${price.toLocaleString()}` : ''}, in cash or Mobile Money, when the work is done. Solid Connect does not take payment or pay you out.`}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      ...shadow.card,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.activeBg,
    },
    text: { flex: 1, gap: 3 },
    title: { fontSize: fontSizes.sm, fontFamily: fonts.extrabold, color: colors.ink },
    body: { fontSize: fontSizes.xs, lineHeight: 17, fontFamily: fonts.medium, color: colors.inkMuted },
  });
}
