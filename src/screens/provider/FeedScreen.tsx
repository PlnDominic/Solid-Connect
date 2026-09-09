import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useFeedRequests } from '../../api/requests';
import { isApiConfigured } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
}

export function FeedScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: requests = [], isLoading, isError, refetch, isFetching } = useFeedRequests(
    profile?.id ?? null,
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          {profile?.area ?? 'Accra'}
          {isApiConfigured() ? ' · matched opportunities' : ' · within 5 km'}
        </Text>
        <Text style={styles.title}>Nearby requests</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, requests.length === 0 && styles.bodyEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.loadingText}>Loading opportunities…</Text>
          </View>
        ) : isError ? (
          <EmptyState
            title="Couldn't load feed"
            subtitle="Check your connection, then try again."
          />
        ) : requests.length === 0 ? (
          <EmptyState
            title="No requests yet"
            subtitle="When customers nearby post a matching job — or send you a direct request — they’ll show up here."
          />
        ) : (
          requests.map((r) => (
            <Pressable
              key={r.id}
              style={styles.card}
              onPress={() => navigation.navigate('RequestDetail', { requestId: r.id })}
            >
              <View style={styles.cardTop}>
                <View style={{ gap: 3 }}>
                  <Text style={styles.cardTitle}>{r.category_label.split('·').pop()?.trim()}</Text>
                  <Text style={styles.cardMeta}>
                    {r.location_label} · {timeAgo(r.created_at)}
                  </Text>
                </View>
                <Text style={styles.cardBudget}>
                  GHS {r.customer_budget ?? r.budget_min}
                  {r.budget_max != null && r.budget_max !== r.budget_min ? `-${r.budget_max}` : ''}
                </Text>
              </View>
              {r.myQuote ? (
                <Badge
                  label="Quote sent"
                  bg={colors.confirmBg}
                  fg={colors.confirm}
                  icon={<Check size={11} strokeWidth={3} color={colors.confirm} />}
                />
              ) : r.request_mode === 'DIRECT' || r.status === 'awaiting_provider' ? (
                <Badge label="Direct request" bg={colors.navyBg} fg={colors.navy} />
              ) : (
                <Badge
                  label={r.category_label.split('·')[0]?.trim() ?? ''}
                  bg={colors.paperDim}
                  fg={colors.inkMuted}
                />
              )}
            </Pressable>
          ))
        )}
        {isError ? (
          <Pressable onPress={() => refetch()} style={styles.retry} disabled={isFetching}>
            <Text style={styles.retryLabel}>{isFetching ? 'Retrying…' : 'Try again'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
      gap: 5,
      backgroundColor: colors.navy,
    },
    eyebrow: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: fonts.medium },
    title: { fontSize: 28, letterSpacing: -0.9, fontFamily: fonts.extrabold, color: colors.white },
    body: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md, flexGrow: 1 },
    bodyEmpty: { justifyContent: 'center' },
    loading: { alignItems: 'center', gap: spacing.md, paddingVertical: 64 },
    loadingText: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    cardMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    cardBudget: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    retry: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    retryLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  });
}
