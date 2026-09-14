import { useEffect, useRef } from 'react';
import { Check, Clock, MapPin, Search, ShieldCheck, Star, X } from 'lucide-react-native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCancelRequest, useMyActiveRequest, useNotifications } from '../../api/requests';
import { useAcceptQuote } from '../../api/jobs';
import { getOrCreateThread } from '../../api/chat';
import { useProvider } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { formatRelativeTime } from '../../lib/geo';
import { haptics } from '../../lib/haptics';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Quote, ServiceRequest } from '../../types/database';

// The customer-side equivalent of the provider RequestsScreen's own local
// StatusBadge - same Badge component, same bg/fg palette per outcome, so
// "matching" / "declined" / "quotes received" read as the same visual
// language on both sides of the marketplace.
function RequestStatusBadge({ kind, count }: { kind: 'awaiting' | 'matching' | 'rejected' | 'quoted'; count?: number }) {
  const { colors } = useTheme();
  switch (kind) {
    case 'awaiting':
      return <Badge label="Awaiting provider response" bg={colors.navyBg} fg={colors.navy} icon={<Clock size={11} strokeWidth={2.6} color={colors.navy} />} />;
    case 'matching':
      return <Badge label="Matching providers" bg={colors.pendingBg} fg={colors.pending} icon={<Search size={11} strokeWidth={2.6} color={colors.pending} />} />;
    case 'rejected':
      return <Badge label="Declined by provider" bg={colors.dangerBg} fg={colors.danger} icon={<X size={11} strokeWidth={3} color={colors.danger} />} />;
    case 'quoted':
      return (
        <Badge
          label={`${count} quote${count === 1 ? '' : 's'} received`}
          bg={colors.confirmBg}
          fg={colors.confirm}
          icon={<Check size={11} strokeWidth={3} color={colors.confirm} />}
        />
      );
  }
}

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: provider } = useProvider(quote.provider_id);
  const acceptQuote = useAcceptQuote();
  const profile = useSessionStore((s) => s.profile);

  if (!provider) return null;

  async function handleAccept() {
    if (!profile) return;
    const job = await acceptQuote.mutateAsync({ requestId: request.id, quoteId: quote.id, customerId: profile.id });
    haptics.success();
    onAccepted(job.id);
  }

  async function handleChat() {
    if (!profile) return;
    const thread = await getOrCreateThread({
      requestId: request.id,
      customerId: profile.id,
      providerId: quote.provider_id,
      asRole: 'customer',
    });
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
        <Text style={styles.quotePrice}>GHS {quote.price.toLocaleString()}</Text>
      </View>

      <Badge label={quote.eta_label} bg={colors.paperDim} fg={colors.inkMuted} icon={<Clock size={11} strokeWidth={2.4} color={colors.inkMuted} />} />

      <View style={styles.quoteActions}>
        <Button title="Accept" onPress={handleAccept} loading={acceptQuote.isPending} style={styles.halfBtn} />
        <Button title="Chat" variant="outline" onPress={handleChat} style={styles.halfBtn} />
      </View>
    </View>
  );
}

export function RequestsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: request, isLoading: requestLoading, refetch: refetchRequest } = useMyActiveRequest(profile?.id ?? null);
  const { data: notifications = [], refetch: refetchNotifs } = useNotifications(profile?.id ?? null);
  const cancelRequest = useCancelRequest();
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetchRequest(), refetchNotifs()]);
  });

  const hasQuotes = request && request.status === 'quoted' && request.quotes.length > 0;
  const quoteCount = request?.quotes.length ?? 0;
  const seenQuoteCount = useRef(quoteCount);
  // Fires only on a real increase while this screen is mounted (a fresh
  // quote landing via refetch/pull-to-refresh) - not on first load, which
  // would otherwise buzz every time someone simply reopens the tab.
  useEffect(() => {
    if (quoteCount > seenQuoteCount.current) haptics.success();
    seenQuoteCount.current = quoteCount;
  }, [quoteCount]);
  const isAwaiting = request?.status === 'awaiting_provider';
  const isRejected = request?.status === 'rejected';
  const isMatching = request?.status === 'matching' || request?.status === 'open';
  const unreadReject = notifications.filter((n) => n.type === 'DIRECT_REJECTED' && !n.read_at);
  const budget = request?.customer_budget ?? request?.budget_min;
  // Editable up through 'matching' (a provider may have already priced
  // the job once it's quoted or awaiting a direct response); cancellable
  // through both of those plus 'quoted'/'awaiting_provider' - anything
  // short of an actual job existing. Matches update_request()/
  // cancel_request()'s own server-side guards in 0033/0034.
  const canEdit = isMatching;
  const canCancel = isMatching || isAwaiting || hasQuotes;

  function handleCancel() {
    if (!request || !profile) return;
    Alert.alert(
      'Cancel this request?',
      'Any providers who already quoted will be notified. This can\'t be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: () => cancelRequest.mutate({ requestId: request.id, customerId: profile.id }),
        },
      ],
    );
  }

  const showFeed =
    unreadReject.length > 0 || isRejected || isAwaiting || isMatching || hasQuotes;

  return (
    <Screen>
      <ScreenHeader title="Requests" large />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {requestLoading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : showFeed ? (
          <View style={styles.body}>
            {unreadReject.slice(0, 3).map((n) => (
              <View key={n.id} style={styles.rejectBanner}>
                <Text style={styles.rejectTitle}>{n.title}</Text>
                <Text style={styles.rejectBody}>{n.body}</Text>
              </View>
            ))}

            {request ? (
              <View style={styles.summary}>
                <View style={styles.summaryTop}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.summaryTitle} numberOfLines={1}>
                      {request.category_label.split('·').pop()?.trim()}
                    </Text>
                    <Text style={styles.summaryMeta}>
                      {request.location_label} · {formatRelativeTime(request.created_at)}
                    </Text>
                  </View>
                  {budget != null ? <Text style={styles.summaryBudget}>GHS {budget.toLocaleString()}</Text> : null}
                </View>

                {isAwaiting ? (
                  <RequestStatusBadge kind="awaiting" />
                ) : isRejected ? (
                  <RequestStatusBadge kind="rejected" />
                ) : hasQuotes ? (
                  <RequestStatusBadge kind="quoted" count={request.quotes.length} />
                ) : (
                  <RequestStatusBadge kind="matching" />
                )}

                {isRejected && request.rejection_reason ? (
                  <Text style={styles.rejectInline}>Reason: {request.rejection_reason}</Text>
                ) : null}

                {(canEdit || canCancel) ? (
                  <View style={styles.summaryActions}>
                    {canEdit ? (
                      <Button
                        title="Edit"
                        variant="outline"
                        onPress={() => navigation.navigate('EditRequest', { requestId: request.id })}
                        style={styles.summaryActionBtn}
                      />
                    ) : null}
                    {canCancel ? (
                      <Button
                        title="Cancel"
                        variant="outline"
                        onPress={handleCancel}
                        loading={cancelRequest.isPending}
                        style={styles.summaryActionBtn}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {hasQuotes && request
              ? request.quotes.map((q) => (
                  <QuoteCard
                    key={q.id}
                    quote={q}
                    request={request}
                    onAccepted={(jobId) =>
                      navigation.navigate('JobsTab', { screen: 'JobDetail', params: { jobId } })
                    }
                    onChat={(threadId, peerId) =>
                      navigation.navigate('ChatTab', { screen: 'ChatThread', params: { threadId, peerId } })
                    }
                  />
                ))
              : null}
          </View>
        ) : (
          <EmptyState
            title="No requests yet"
            subtitle="Post a general request from Home, or pick a provider and send a direct request."
            action={{ label: 'Post a request', onPress: () => navigation.navigate('HomeTab', { screen: 'Home' }) }}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md },
    summary: {
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      gap: spacing.md,
      ...shadow.card,
    },
    summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    summaryTitle: { fontSize: 15.5, fontFamily: fonts.bold, color: colors.ink },
    summaryMeta: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
    summaryBudget: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    summaryActions: { flexDirection: 'row', gap: spacing.sm },
    summaryActionBtn: { flex: 1, height: 40 },
    rejectInline: { fontSize: 14.5, fontFamily: fonts.medium, color: colors.danger },
    rejectBanner: {
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      gap: 4,
      ...shadow.card,
    },
    rejectTitle: { fontSize: 15.5, fontFamily: fonts.bold, color: colors.ink },
    rejectBody: { fontSize: 14.5, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19.5 },

    quoteCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    quoteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    quoteIdentity: { flexDirection: 'row', gap: spacing.md, flexShrink: 1 },
    quoteNameWrap: { gap: 4, flexShrink: 1 },
    quoteNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    quoteName: { fontSize: 16.5, fontFamily: fonts.bold, color: colors.ink },

    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderRadius: radii.sm,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    badgeVerified: { backgroundColor: colors.confirmBg },
    badgeCertified: { backgroundColor: colors.navy },
    badgeTextVerified: { fontSize: 9, fontFamily: fonts.extrabold, color: colors.confirm, letterSpacing: 0.3 },
    badgeTextOnDark: { fontSize: 9, fontFamily: fonts.extrabold, color: colors.white, letterSpacing: 0.3 },

    quoteMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    quoteMeta: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
    quoteMetaDim: { fontSize: 13.5, fontFamily: fonts.medium, color: colors.inkFaint },
    quotePrice: { fontSize: 20.5, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },

    quoteActions: { flexDirection: 'row', gap: spacing.sm },
    halfBtn: { flex: 1, height: 46 },
  });
}
