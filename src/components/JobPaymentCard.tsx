import { StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import type { Job, Payment } from '../types/database';
import { fonts, fontSizes, radii, shadow, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

type Row = { label: string; value: string; tone: 'done' | 'due' | 'muted' };

/**
 * Where a job's money stands with Solid Connect (0065): the deposit that
 * secured the booking, then the balance after the work. Both go to Solid
 * Connect - customers never pay providers directly, and the card says so.
 */
export function JobPaymentCard({ job, payment, role }: { job: Job; payment: Payment; role: 'customer' | 'provider' }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const deposit = Number(payment.deposit_amount ?? 0);
  const balance = Math.max(Number(payment.amount) - deposit, 0);
  const ghs = (n: number) => `GHS ${n.toLocaleString()}`;
  const s = payment.status;

  const rows: Row[] = [];
  if (deposit > 0) {
    const depositPaid = s === 'deposit_held' || s === 'held' || s === 'released' || s === 'forfeited' || !!payment.deposit_paid_at;
    rows.push({
      label: 'Deposit',
      value: depositPaid ? `${ghs(deposit)} paid` : `${ghs(deposit)} due to secure the booking`,
      tone: depositPaid ? 'done' : 'due',
    });
    const balancePaid = s === 'held' || s === 'released';
    rows.push({
      label: 'Balance',
      value: balancePaid
        ? `${ghs(balance)} paid`
        : s === 'forfeited' || s === 'refunded' || s === 'partially_refunded'
          ? 'Not due'
          : job.status === 'awaiting_completion_confirmation'
            ? `${ghs(balance)} due now`
            : `${ghs(balance)} after the work is done`,
      tone: balancePaid ? 'done' : job.status === 'awaiting_completion_confirmation' ? 'due' : 'muted',
    });
  } else {
    const paid = s === 'held' || s === 'released';
    rows.push({ label: 'Payment', value: paid ? `${ghs(Number(payment.amount))} paid` : `${ghs(Number(payment.amount))} due`, tone: paid ? 'done' : 'due' });
  }

  const outcome =
    s === 'released'
      ? role === 'provider'
        ? 'Released to you, minus commission.'
        : 'Released to the provider.'
      : s === 'forfeited'
        ? role === 'provider'
          ? 'The customer cancelled. Part of their deposit comes to you as compensation.'
          : 'You cancelled after paying the deposit, so Solid Connect kept it.'
        : s === 'refunded' || s === 'partially_refunded'
          ? payment.refund_amount
            ? `${ghs(Number(payment.refund_amount))} is being refunded to the customer.`
            : 'Refunded to the customer.'
          : role === 'provider' && s === 'pending' && deposit > 0
            ? "Don't travel or start until the deposit is paid."
            : null;

  const toneColor = { done: colors.confirm, due: colors.pending, muted: colors.inkFaint };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>PAYMENT</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Text style={styles.rowLabel}>{r.label}</Text>
          <Text style={[styles.rowValue, { color: toneColor[r.tone] }]}>{r.value}</Text>
        </View>
      ))}
      {outcome ? <Text style={styles.outcome}>{outcome}</Text> : null}
      <View style={styles.notice}>
        <ShieldCheck size={14} strokeWidth={2.2} color={colors.inkMuted} />
        <Text style={styles.noticeText}>
          {role === 'provider'
            ? 'Solid Connect collects every payment and pays you. Never ask a customer to pay you directly.'
            : 'Only pay through Solid Connect. Never pay a provider directly.'}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: { borderRadius: radii.lg, backgroundColor: colors.card, padding: spacing.lg, gap: 8, ...shadow.card },
    label: { fontSize: fontSizes.xs, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
    rowLabel: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkMuted },
    rowValue: { flexShrink: 1, textAlign: 'right', fontSize: fontSizes.sm, fontFamily: fonts.semibold },
    outcome: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: fonts.medium, color: colors.ink },
    notice: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'flex-start',
      marginTop: 2,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
    },
    noticeText: { flex: 1, fontSize: fontSizes.xs, lineHeight: 17, fontFamily: fonts.medium, color: colors.inkMuted },
  });
}
