import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { useMyActiveRequest } from '../../api/requests';
import { useAcceptQuote } from '../../api/jobs';
import { getOrCreateThread } from '../../api/chat';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, shadow, spacing } from '../../theme';
import type { Quote, ServiceRequest } from '../../types/database';

function QuoteCard({
  quote,
  request,
  onAccepted,
  onChat,
}: {
  quote: Quote;
  request: ServiceRequest;
  onAccepted: (jobId: string) => void;
  onChat: (threadId: string, peerId: string) => void;
}) {
  const { data: provider } = useProvider(quote.provider_id);
  const acceptQuote = useAcceptQuote();
  const profile = useSessionStore((s) => s.profile);

  if (!provider) return null;

  async function handleAccept() {
    if (!profile) return;
    const job = await acceptQuote.mutateAsync({ requestId: request.id, quoteId: quote.id, customerId: profile.id });
    onAccepted(job.id);
  }

  async function handleChat() {
    if (!profile) return;
    const thread = await getOrCreateThread({ requestId: request.id, customerId: profile.id, providerId: quote.provider_id });
    onChat(thread.id, quote.provider_id);
  }

  const badgeColors =
    quote.badge_kind === 'certified' ? { bg: colors.ink, fg: colors.white } : { bg: colors.tile, fg: colors.black };

  return (
    <View style={styles.quoteCard}>
      <View style={styles.quoteTop}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Avatar initials={provider.initials} size={44} />
          <View style={{ gap: 3 }}>
            <Text style={styles.quoteName}>{provider.full_name}</Text>
            <Text style={styles.quoteMeta}>
              {provider.provider_rating.toFixed(1)} ★ · {provider.provider_jobs_count} jobs · {provider.provider_distance_km} km
            </Text>
          </View>
        </View>
        <Text style={styles.quotePrice}>GHS {quote.price}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Badge label={quote.badge_label} bg={badgeColors.bg} fg={badgeColors.fg} />
        <Badge label={quote.eta_label} bg={colors.hairlineSoft} fg={colors.textMuted} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Accept" onPress={handleAccept} loading={acceptQuote.isPending} style={styles.halfBtn} />
        <Button title="Chat" variant="outline" onPress={handleChat} style={styles.halfBtn} />
      </View>
    </View>
  );
}

export function RequestsScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: request } = useMyActiveRequest(profile?.id ?? null);

  const hasQuotes = request && (request.status === 'quoted' || request.status === 'accepted') && request.quotes.length > 0;

  return (
    <Screen>
      <ScreenHeader title="Requests" large />
      <ScrollView>
        {hasQuotes && request ? (
          <View style={styles.body}>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>
                {request.category_label} · {request.location_label}
              </Text>
              <Text style={styles.summarySub}>
                Requested today · Budget GHS {request.budget_min}–{request.budget_max} · {request.quotes.length} quotes received
              </Text>
            </View>
            {request.quotes.map((q) => (
              <QuoteCard
                key={q.id}
                quote={q}
                request={request}
                onAccepted={(jobId) => navigation.navigate('JobsTab', { screen: 'JobDetail', params: { jobId } })}
                onChat={(threadId, peerId) => navigation.navigate('ChatTab', { screen: 'ChatThread', params: { threadId, peerId } })}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No requests yet" subtitle="Post a request from Home to get quotes from verified providers nearby." />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  summary: { padding: 12, paddingHorizontal: 14, borderRadius: radii.lg, backgroundColor: colors.tile, gap: 3 },
  summaryTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.black },
  summarySub: { fontSize: 12, color: colors.textMuted },
  quoteCard: { borderRadius: radii.xxl, backgroundColor: colors.card, padding: 16, gap: 12, ...shadow.card },
  quoteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  quoteName: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  quoteMeta: { fontSize: 12, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  quotePrice: { fontSize: 19, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
  halfBtn: { flex: 1, height: 44 },
});
