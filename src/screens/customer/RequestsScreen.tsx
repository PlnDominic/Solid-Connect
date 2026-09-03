import { MapPin, ShieldCheck, Star } from 'lucide-react-native';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { useMyActiveRequest } from '../../api/requests';
import { useAcceptQuote } from '../../api/jobs';
import { getOrCreateThread } from '../../api/chat';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';
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

  return (
    <View style={styles.quoteCard}>
      <View style={styles.quoteTop}>
        <View style={styles.quoteIdentity}>
          <Avatar initials={provider.initials} size={44} />
          <View style={styles.quoteNameWrap}>
            <View style={styles.quoteNameRow}>
              <Text style={styles.quoteName}>{provider.full_name}</Text>
              {quote.badge_kind === 'certified' ? (
                <View style={[styles.badge, styles.badgeCertified]}>
                  <ShieldCheck size={10} strokeWidth={2.8} color={colors.white} />
                  <Text style={styles.badgeTextOnDark}>CERTIFIED</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.badgeVerified]}>
                  <ShieldCheck size={10} strokeWidth={2.8} color={colors.confirm} />
                  <Text style={styles.badgeTextVerified}>VERIFIED</Text>
                </View>
              )}
            </View>
            <View style={styles.quoteMetaRow}>
              <Star color={colors.ink} fill={colors.ink} size={11} strokeWidth={2} />
              <Text style={styles.quoteMeta}>{provider.provider_rating.toFixed(1)}</Text>
              <Text style={styles.quoteMetaDim}>· {provider.provider_jobs_count} jobs ·</Text>
              <MapPin color={colors.inkFaint} size={11} strokeWidth={2} />
              <Text style={styles.quoteMeta}>{provider.provider_distance_km} km</Text>
            </View>
          </View>
        </View>
        <Text style={styles.quotePrice}>GHS {quote.price}</Text>
      </View>

      <View style={styles.quoteEta}>
        <Text style={styles.quoteEtaText}>{quote.eta_label}</Text>
      </View>

      <View style={styles.quoteActions}>
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
      <ScrollView showsVerticalScrollIndicator={false}>
        {hasQuotes && request ? (
          <View style={styles.body}>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>
                {request.category_label} · {request.location_label}
              </Text>
              <Text style={styles.summarySub}>
                Requested today · Budget GHS {request.budget_min}-{request.budget_max} · {request.quotes.length} quotes received
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
  body: { padding: spacing.lg, gap: spacing.md },
  summary: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    gap: 3,
  },
  summaryTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  summarySub: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkMuted },

  quoteCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  quoteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  quoteIdentity: { flexDirection: 'row', gap: spacing.md, flexShrink: 1 },
  quoteNameWrap: { gap: 4, flexShrink: 1 },
  quoteNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  quoteName: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radii.sm, paddingVertical: 2, paddingHorizontal: 6 },
  badgeVerified: { backgroundColor: colors.confirmBg },
  badgeCertified: { backgroundColor: colors.navy },
  badgeTextVerified: { fontSize: 9, fontFamily: fonts.extrabold, color: colors.confirm, letterSpacing: 0.3 },
  badgeTextOnDark: { fontSize: 9, fontFamily: fonts.extrabold, color: colors.white, letterSpacing: 0.3 },

  quoteMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quoteMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  quoteMetaDim: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
  quotePrice: { fontSize: 19, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },

  quoteEta: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.paperDim,
  },
  quoteEtaText: { fontSize: 11.5, fontFamily: fonts.semibold, color: colors.inkMuted },

  quoteActions: { flexDirection: 'row', gap: spacing.sm },
  halfBtn: { flex: 1, height: 46 },
});
