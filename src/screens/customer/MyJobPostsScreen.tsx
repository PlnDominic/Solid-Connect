import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, ClipboardList, Plus, Users } from 'lucide-react-native';
import { expiryLabel, formatJobPostBudget, isPostExpired, isPostOpen, postedAgo, useMyJobPosts, type JobPost } from '../../api/jobPosts';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function statusBadge(post: Pick<JobPost, 'status' | 'expires_at'>, colors: ReturnType<typeof useTheme>['colors']) {
  if (isPostExpired(post)) return { label: 'Expired', bg: colors.paperDim, fg: colors.inkMuted };
  switch (post.status) {
    case 'open':
      return { label: 'Open', bg: colors.confirmBg, fg: colors.confirm };
    case 'hired':
      return { label: 'Hired', bg: colors.activeBg, fg: colors.activeDeep };
    default:
      return { label: 'Closed', bg: colors.paperDim, fg: colors.inkMuted };
  }
}

export function MyJobPostsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: posts = [], isLoading, isError, refetch } = useMyJobPosts(profile?.id ?? null);
  const [filter, setFilter] = useState('open');
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await refetch();
  });

  const counts = useMemo(
    () => ({
      open: posts.filter((p) => isPostOpen(p)).length,
      done: posts.filter((p) => !isPostOpen(p)).length,
    }),
    [posts],
  );
  const options: FilterOption[] = [
    { id: 'open', label: `Open (${counts.open})` },
    { id: 'done', label: `Closed, hired and expired (${counts.done})` },
  ];
  const visible = posts.filter((p) => (filter === 'open' ? isPostOpen(p) : !isPostOpen(p)));

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="My job posts" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
      >
        <Pressable
          style={({ pressed }) => [styles.newCard, pressed && styles.pressed]}
          onPress={() => navigation.navigate('PostJob')}
          accessibilityRole="button"
        >
          <View style={styles.newIcon}>
            <Plus size={18} strokeWidth={2.6} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.newTitle}>Post a new job</Text>
            <Text style={styles.newMeta}>Every provider sees it on their feed</Text>
          </View>
          <ChevronRight size={18} strokeWidth={2.4} color={colors.inkFaint} />
        </Pressable>

        <FilterChips options={options} value={filter} onChange={setFilter} />

        {isLoading ? (
          <ActivityIndicator color={colors.ink} style={{ paddingVertical: spacing.xxxl }} />
        ) : isError ? (
          <EmptyState
            title="Couldn't load your posts"
            subtitle="Check your connection, then try again."
            action={{ label: 'Try again', onPress: () => refetch() }}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={filter === 'open' ? 'No open posts' : 'Nothing here yet'}
            subtitle={
              filter === 'open'
                ? 'Post a job and providers who want it will let you know.'
                : 'Posts you close, hire from or that expire will move here.'
            }
            action={filter === 'open' ? { label: 'Post a Job', onPress: () => navigation.navigate('PostJob') } : undefined}
          />
        ) : (
          visible.map((p) => {
            const badge = statusBadge(p, colors);
            return (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => navigation.navigate('JobPostDetail', { postId: p.id })}
                accessibilityRole="button"
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{p.title}</Text>
                    <Text style={styles.cardMeta}>
                      {p.category_label} · {p.location_label} · {postedAgo(p.created_at)}
                    </Text>
                  </View>
                  <Badge label={badge.label} bg={badge.bg} fg={badge.fg} />
                </View>
                {expiryLabel(p) ? <Text style={styles.cardMeta}>{expiryLabel(p)}</Text> : null}
                <View style={styles.cardBottom}>
                  <Text style={styles.cardBudget}>{formatJobPostBudget(p)}</Text>
                  <View style={styles.interest}>
                    <Users size={14} strokeWidth={2.2} color={p.interest_count ? colors.active : colors.inkFaint} />
                    <Text style={[styles.interestText, p.interest_count > 0 && styles.interestTextActive]}>
                      {p.interest_count} interested
                    </Text>
                  </View>
                </View>
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
    body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
    pressed: { opacity: 0.9 },
    newCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.xxl,
      backgroundColor: colors.card,
      ...shadow.card,
    },
    newIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.active,
    },
    newTitle: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    newMeta: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkMuted, marginTop: 2 },
    card: { borderRadius: radii.lg, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.md, ...shadow.card },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    cardTitle: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    cardMeta: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardBudget: { fontSize: fontSizes.md, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    interest: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    interestText: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkFaint },
    interestTextActive: { color: colors.active },
  });
}
