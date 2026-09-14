import { Fragment } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { fonts, radii, shadow, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

export interface JobQuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  tone?: 'default' | 'danger';
}

/** Message / Receipt / Dispute used to be a stack of identical full-width
 * outline buttons - buttons.md: "Keep the number of prominent buttons to
 * one or two per view", and three same-weight full-width buttons plus a
 * sticky footer CTA left this screen with no real hierarchy. These are
 * secondary, occasional actions - a single elevated row of labeled round
 * icon buttons (the Wallet/Messages "contact detail" pattern) reads as one
 * unit, leaves the one real CTA (footer, or the primary Button on the
 * provider side) as the only prominent control on screen. */
export function JobQuickActions({ actions }: { actions: JobQuickAction[] }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.card}>
      {actions.map((action, i) => {
        const Icon = action.icon;
        const danger = action.tone === 'danger';
        return (
          <Fragment key={action.key}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <View style={[styles.icon, danger && styles.iconDanger]}>
                <Icon size={19} strokeWidth={2} color={danger ? colors.danger : colors.ink} />
              </View>
              <Text style={[styles.label, danger && styles.labelDanger]} numberOfLines={1}>
                {action.label}
              </Text>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      paddingVertical: spacing.md,
      ...shadow.card,
    },
    divider: { width: 1, backgroundColor: colors.hairline, marginVertical: spacing.xs },
    action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
    actionPressed: { opacity: 0.7 },
    icon: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    iconDanger: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBg },
    label: { fontSize: 11.5, fontFamily: fonts.semibold, color: colors.inkMuted },
    labelDanger: { color: colors.danger },
  });
}
