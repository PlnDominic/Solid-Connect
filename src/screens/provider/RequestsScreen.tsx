import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Check, Clock, X } from 'lucide-react-native';
import { useProviderRequestHistory, type ProviderRequestHistoryItem, type ProviderRequestStatus } from '../../api/requests';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const STATUS_FILTERS: FilterOption[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function bucketFor(status: ProviderRequestStatus): 'pending' | 'won' | 'lost' {
  if (status === 'quote_accepted') return 'won';
  if (status === 'quote_declined' || status === 'direct_declined') return 'lost';
  return 'pending';
}

function StatusBadge({ status }: { status: ProviderRequestStatus }) {
  const { colors } = useTheme();
  switch (status) {
    case 'awaiting_response':
      return <Badge label="Awaiting your response" bg={colors.navyBg} fg={colors.navy} icon={<Clock size={11} strokeWidth={2.6} color={colors.navy} />} />;
    case 'quote_sent':
      return <Badge label="Quote sent" bg={colors.confirmBg} fg={colors.confirm} icon={<Check size={11} strokeWidth={3} color={colors.confirm} />} />;
    case 'quote_accepted':
      return <Badge label="Accepted" bg={colors.confirmBg} fg={colors.confirm} icon={<Check size={11} strokeWidth={3} color={colors.confirm} />} />;
    case 'quote_declined':
      return <Badge label="Not selected" bg={colors.dangerBg} fg={colors.danger} icon={<X size={11} strokeWidth={3} color={colors.danger} />} />;
    case 'direct_declined':
      return <Badge label="Declined" bg={colors.dangerBg} fg={colors.danger} icon={<X size={11} strokeWidth={3} color={colors.danger} />} />;
  }
}

/**
 * "My Requests" - a persistent record of every request this provider has
 * responded to, win or lose. The Feed only ever shows what's still live
 * (open/matching/quoted), so once a customer picks someone else the
 * request just vanishes from it with no trace - this is the page that
 * remembers what happened, the provider-side equivalent of the customer's
 * own Requests tab tracking their posted request's lifecycle.
 */
export function RequestsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: items = [], isLoading, refetch } = useProviderRequestHistory(profile?.id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);
  const [filter, setFilter] = useState('all');

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => bucketFor(item.myStatus) === filter);
  }, [items, filter]);

  // RequestDetailScreen only ever renders the interactive quote/accept
  // form - it has no read-only view for a request already decided one
  // way or the other. So a still-open item goes there; a won item goes
  // to the Jobs list instead (the job itself now lives there - this
  // screen doesn't know its id without another query, and "go see your
  // jobs" is still a real, useful destination); a lost one has nowhere
  // useful left to go and stays a plain summary card.
  function openItem(item: ProviderRequestHistoryItem) {
    if (item.myStatus === 'quote_accepted') {
      navigation.navigate('JobsTab', { screen: 'JobsHome' });
      return;
    }
    navigation.navigate('FeedTab', { screen: 'RequestDetail', params: { requestId: item.request.id } });
  }

  return (
    <Screen>
      <ScreenHeader title="My Requests" large />
      <View style={styles.filtersWrap}>
        <FilterChips options={STATUS_FILTERS} value={filter} onChange={setFilter} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, filteredItems.length === 0 && styles.bodyEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title={items.length ? 'No matches' : 'No requests yet'}
            subtitle={
              items.length
                ? 'Try a different filter.'
                : 'Once you send a quote or respond to a direct request, it shows up here - whether you win it or not.'
            }
          />
        ) : (
          filteredItems.map((item) => {
            // A lost item (not selected / declined) has nowhere useful
            // left to go - see openItem() above for the other statuses.
            const isActionable = item.myStatus !== 'quote_declined' && item.myStatus !== 'direct_declined';
            return (
              <Pressable
                key={item.request.id}
                style={({ pressed }) => [styles.card, pressed && isActionable && styles.cardPressed]}
                onPress={isActionable ? () => openItem(item) : undefined}
                disabled={!isActionable}
              >
                <View style={styles.cardTop}>
                  <View style={{ gap: 3, flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.request.category_label.split('·').pop()?.trim()}</Text>
                    <Text style={styles.cardMeta}>
                      {item.request.location_label} · {timeAgo(item.updatedAt)}
                    </Text>
                  </View>
                  {item.price != null ? <Text style={styles.cardBudget}>GHS {item.price}</Text> : null}
                </View>
                <StatusBadge status={item.myStatus} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    filtersWrap: { paddingBottom: spacing.sm },
    body: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md, flexGrow: 1 },
    bodyEmpty: { justifyContent: 'center' },
    loading: { alignItems: 'center', paddingVertical: 64 },
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    cardPressed: { opacity: 0.92 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    cardMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    cardBudget: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
  });
}
