import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ratingLabel } from '../../lib/rating';
import { useAcceptQuote } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useMyActiveRequests } from '../../api/requests';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { haptics } from '../../lib/haptics';
import { compareHighlights, type Highlight } from '../../lib/quoteLogic';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Quote } from '../../types/database';
import { confirmQuoteAcceptance } from './confirmQuoteAcceptance';

const COLUMN_WIDTH = 190;

/**
 * 2-3 quotes side by side. Each fact is a row so the eye compares down a
 * row, not across cards. Highlights identify the lowest price and top rating.
 */
export function CompareQuotesScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const ids: string[] = route.params?.quoteIds ?? [];
  const { data: requests, isLoading, isError, refetch } = useMyActiveRequests(profile?.id ?? null);
  const request = requests?.find((item) => item.id === route.params?.requestId);
  const acceptQuote = useAcceptQuote();

  const quotes = ids.map((id) => request?.quotes.find((q) => q.id === id)).filter((q): q is Quote => !!q);
  // Hooks can't run in a loop; the screen supports at most 3 columns.
  const p0 = useProvider(quotes[0]?.provider_id).data;
  const p1 = useProvider(quotes[1]?.provider_id).data;
  const p2 = useProvider(quotes[2]?.provider_id).data;
  const providers = [p0, p1, p2];

  const highlights = compareHighlights(
    quotes.map((q, i) => ({
      id: q.id,
      price: q.price,
      rating: providers[i]?.provider_rating ?? null,
      distanceKm: null,
    })),
  );

  function handleAccept(quote: Quote, providerName: string) {
    if (!profile || !request || acceptQuote.isPending) return;
    confirmQuoteAcceptance(providerName, quote.price, async () => {
      const job = await acceptQuote.mutateAsync({ quoteId: quote.id, price: quote.price, revision: quote.revision ?? 1 });
      haptics.success();
      navigation.replace('JobDetail', { jobId: job.id });
    });
  }

  const row = (label: string, render: (q: Quote, i: number) => React.ReactNode) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowCells}>
        {quotes.map((q, i) => (
          <View key={q.id} style={styles.cell}>
            {render(q, i)}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title="Compare quotes" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <ActivityIndicator color={colors.ink} />
      ) : isError && !requests ? (
        <EmptyState title="Could not load quotes" action={{ label: 'Retry', onPress: () => void refetch() }} />
      ) : quotes.length < 2 ? (
        <Text style={styles.empty}>These quotes are no longer available. Go back to see the current ones.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              {row('Provider', (q, i) => (
                <View style={styles.providerCell}>
                  <Avatar initials={providers[i]?.initials ?? ''} photoUrl={providers[i]?.photo_url} size={36} />
                  <Text style={styles.providerName} numberOfLines={2}>{providers[i]?.full_name ?? '…'}</Text>
                </View>
              ))}
              {row('Price', (q) => (
                <View style={{ gap: 4 }}>
                  <Text style={styles.price}>GHS {q.price.toLocaleString()}</Text>
                  {(highlights.get(q.id) ?? []).map((h: Highlight) => (
                    <Text key={h} style={styles.flag}>{h}</Text>
                  ))}
                </View>
              ))}
              {row('Breakdown', (q) =>
                q.items?.length ? (
                  <View style={{ gap: 2 }}>
                    {q.items.map((it, n) => (
                      <Text key={n} style={styles.small}>{it.label}: GHS {it.amount.toLocaleString()}</Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.dim}>Not itemised</Text>
                ),
              )}
              {row('Can start', (q) => <Text style={styles.value}>{q.eta_label}</Text>)}
              {row('Rating', (q, i) => (
                <Text style={styles.value}>
                  {providers[i] ? `${ratingLabel(providers[i]!)} ★` : '…'}
                </Text>
              ))}
              {row('Jobs done', (q, i) => <Text style={styles.value}>{providers[i]?.provider_jobs_count ?? '…'}</Text>)}
              {row('Verification', (q) => <Text style={styles.value}>{q.badge_kind === 'certified' ? 'Certified' : q.badge_kind === 'verified' ? 'Verified' : 'Not yet verified'}</Text>)}
              {row('Note', (q) => (q.note ? <Text style={styles.small}>“{q.note}”</Text> : <Text style={styles.dim}>-</Text>))}
              {row('', (quote, index) => (
                <Button
                  title="Accept"
                  onPress={() => handleAccept(quote, providers[index]?.full_name ?? 'this provider')}
                  disabled={!providers[index]}
                  loading={acceptQuote.isPending}
                  style={styles.acceptBtn}
                />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg },
    empty: { padding: spacing.xl, fontSize: fontSizes.sm, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
    table: { gap: spacing.md },
    row: { gap: 4 },
    rowLabel: { fontSize: fontSizes.xs, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6, textTransform: 'uppercase' },
    rowCells: { flexDirection: 'row', gap: spacing.sm },
    cell: {
      width: COLUMN_WIDTH,
      minHeight: 44,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.hairline,
      padding: spacing.md,
      justifyContent: 'center',
    },
    providerCell: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    providerName: { flex: 1, fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.ink },
    price: { fontSize: fontSizes.xl, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    flag: { fontSize: fontSizes.xs, fontFamily: fonts.bold, color: colors.confirm },
    value: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.ink },
    small: { fontSize: fontSizes.xs, lineHeight: 16, fontFamily: fonts.regular, color: colors.inkMuted },
    dim: { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.inkFaint },
    acceptBtn: { height: 44 },
  });
}
