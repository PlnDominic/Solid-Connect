import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { summarizePayouts, useProviderPayouts, type PayoutRow } from '../../api/earnings';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const ghs = (n: number) => `GHS ${Math.round(n * 100) / 100 === Math.round(n) ? Math.round(n).toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_COPY: Record<PayoutRow['status'], string> = {
  pending: 'On the way',
  paid: 'Paid',
  failed: 'Failed',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function EarningsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: payouts = [], isLoading, isRefetching, refetch } = useProviderPayouts(profile?.id);
  const summary = useMemo(() => summarizePayouts(payouts), [payouts]);
  const maxMonth = Math.max(...summary.months.map((m) => m.net), 1);

  return (
    <Screen>
      <ScreenHeader title="Earnings" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.ink} />}
      >
        {isLoading ? <ActivityIndicator color={colors.ink} /> : null}

        <View style={styles.grid}>
          <View style={[styles.card, styles.hero]}>
            <Text style={styles.label}>ON THE WAY TO YOU</Text>
            <Text style={styles.heroValue}>{ghs(summary.pendingNet)}</Text>
            <Text style={styles.note}>Sent after Solid Connect processes your payout.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>PAID OUT</Text>
            <Text style={styles.value}>{ghs(summary.paidNet)}</Text>
            <Text style={styles.note}>{summary.jobsPaid} job{summary.jobsPaid === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>THIS MONTH</Text>
            <Text style={styles.value}>{ghs(summary.monthNet)}</Text>
            <Text style={styles.note}>After commission</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>LAST 6 MONTHS</Text>
          <View style={styles.chart} accessibilityLabel="Earnings per month for the last six months">
            {summary.months.map((m, i) => (
              <View key={m.key} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${Math.max(m.net > 0 ? 6 : 0, (m.net / maxMonth) * 100)}%`, opacity: i === summary.months.length - 1 ? 1 : 0.55 },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>Solid Connect kept {ghs(summary.commissionTotal)} in commission so far.</Text>
        </View>

        <Text style={styles.sectionTitle}>Payout history</Text>
        {!isLoading && payouts.length === 0 ? (
          <Text style={styles.note}>No payouts yet. They appear here once a customer confirms a completed job.</Text>
        ) : null}
        {payouts.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {p.job_title ?? 'Job payment'}
              </Text>
              <Text style={styles.note}>
                {p.status === 'paid' && p.paid_at ? `Paid ${formatDate(p.paid_at)}` : formatDate(p.created_at)}
                {p.payout_method ? ` · ${p.payout_method}` : ''}
              </Text>
              <Text style={styles.note}>
                Job {ghs(p.gross_amount)} · commission {ghs(p.commission_amount)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.rowAmount}>{ghs(p.net_amount)}</Text>
              <View style={[styles.chip, p.status === 'paid' && styles.chipPaid, p.status === 'failed' && styles.chipFailed]}>
                <Text style={[styles.chipText, p.status === 'paid' && { color: colors.confirm }, p.status === 'failed' && { color: colors.danger }]}>
                  {STATUS_COPY[p.status]}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
    grid: { gap: spacing.md },
    card: { borderRadius: radii.lg, backgroundColor: colors.card, padding: spacing.lg, gap: 6, ...shadow.card },
    hero: { backgroundColor: colors.active },
    label: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    heroValue: { fontSize: 30, fontFamily: fonts.bold, color: colors.white, fontVariant: ['tabular-nums'] },
    value: { fontSize: 22, fontFamily: fonts.bold, color: colors.ink, fontVariant: ['tabular-nums'] },
    note: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkMuted },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 120, marginTop: 6 },
    barCol: { flex: 1, height: '100%', alignItems: 'center', gap: 6 },
    barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: colors.paperDim, borderRadius: radii.sm, overflow: 'hidden' },
    bar: { width: '100%', backgroundColor: colors.active, borderRadius: radii.sm },
    barLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.inkFaint },
    sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink, marginTop: spacing.sm },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
      ...shadow.card,
    },
    rowTitle: { fontSize: 14.5, fontFamily: fonts.semibold, color: colors.ink },
    rowAmount: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink, fontVariant: ['tabular-nums'] },
    chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm, backgroundColor: colors.pendingBg },
    chipPaid: { backgroundColor: colors.confirmBg },
    chipFailed: { backgroundColor: colors.dangerBg },
    chipText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.pending },
  });
}
