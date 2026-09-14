import { useQuery } from '@tanstack/react-query';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useJob, usePayment } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { fetchProfile } from '../../api/profile';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * A completed job's receipt - shared by the customer's and the provider's
 * Job Detail screens (same job, same receipt, just viewed from either
 * side). Read-only: it renders what's already in `jobs` and `payments`,
 * it doesn't compute anything new. Sharing uses React Native's built-in
 * Share API rather than generating a PDF - a plain-text summary is enough
 * for "send this to my accountant" or "keep a copy", and it needs no new
 * dependency.
 */
export function ReceiptScreen({ navigation, route }: { navigation: any; route: any }) {
  const jobId: string = route.params.jobId;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: job } = useJob(jobId);
  const { data: payment } = usePayment(jobId);
  const { data: provider } = useProvider(job?.provider_id);
  const { data: customer } = useQuery({
    queryKey: ['profile', job?.customer_id],
    queryFn: () => fetchProfile(job!.customer_id),
    enabled: !!job?.customer_id,
  });

  if (!job) return <Screen edges={['top']} />;

  const receiptNumber = job.id.slice(0, 8).toUpperCase();
  const paid = payment?.status === 'released';

  async function handleShare() {
    if (!job) return;
    const lines = [
      'Solid Connect - Job receipt',
      `Receipt #${receiptNumber}`,
      '',
      job.title,
      `Provider: ${provider?.full_name ?? '—'}`,
      `Customer: ${customer?.full_name ?? '—'}`,
      `Location: ${job.location_label}`,
      '',
      `Amount: GHS ${job.price}`,
      `Payment status: ${paid ? 'Paid' : 'Pending release'}`,
      job.completed_at ? `Completed: ${formatDate(job.completed_at)}` : null,
      payment?.released_at ? `Paid on: ${formatDate(payment.released_at)}` : null,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // User dismissed the share sheet - nothing to do.
    }
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Receipt" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.brand}>Solid Connect</Text>
            <Text style={styles.receiptNumber}>#{receiptNumber}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobLocation}>{job.location_label}</Text>

          <View style={styles.rows}>
            <Row label="Provider" value={provider?.full_name ?? '—'} />
            <Row label="Customer" value={customer?.full_name ?? '—'} />
            {job.completed_at ? <Row label="Completed" value={formatDate(job.completed_at)} /> : null}
            {payment?.released_at ? <Row label="Paid on" value={formatDate(payment.released_at)} /> : null}
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>GHS {job.price}</Text>
          </View>
          <View style={[styles.statusPill, paid ? styles.statusPillPaid : styles.statusPillPending]}>
            <Text style={[styles.statusPillText, paid ? styles.statusPillTextPaid : styles.statusPillTextPending]}>
              {paid ? 'Paid' : 'Pending release'}
            </Text>
          </View>
        </View>

        <Button title="Share receipt" variant="outline" onPress={handleShare} />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13.5, fontFamily: fonts.medium, color: colors.inkFaint }}>{label}</Text>
      <Text style={{ fontSize: 13.5, fontFamily: fonts.semibold, color: colors.ink }}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { flex: 1, padding: spacing.lg, gap: spacing.lg },
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brand: { fontSize: 15.5, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.2 },
    receiptNumber: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint, fontVariant: ['tabular-nums'] },
    divider: { height: 1, backgroundColor: colors.hairline },
    jobTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
    jobLocation: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkMuted, marginTop: -8 },
    rows: { gap: 8 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    totalLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    totalValue: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    statusPill: {
      alignSelf: 'flex-start',
      paddingVertical: 5,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
    },
    statusPillPaid: { backgroundColor: colors.successBg },
    statusPillPending: { backgroundColor: colors.paperDim },
    statusPillText: { fontSize: 12, fontFamily: fonts.bold },
    statusPillTextPaid: { color: colors.successFg },
    statusPillTextPending: { color: colors.inkFaint },
  });
}
