import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ratingLabel } from '../../lib/rating';
import { CheckCircle2, ShieldCheck, Star, Users } from 'lucide-react-native';
import {
  expiryLabel,
  isPostExpired,
  isPostOpen,
  useDeleteJobPost,
  useJobPost,
  useJobPostInterests,
  useSetInterestStatus,
  useSetJobPostStatus,
  type JobPostInterestWithProvider,
} from '../../api/jobPosts';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { JobPostSummary } from '../../components/JobPostSummary';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { statusBadge } from './MyJobPostsScreen';

export function JobPostDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const postId: string = route?.params?.postId;
  const justPosted: boolean = !!route?.params?.justPosted;
  const { data: post, isLoading } = useJobPost(postId);
  const { data: interests = [], isLoading: interestsLoading } = useJobPostInterests(postId);
  const setPostStatus = useSetJobPostStatus();
  const setInterestStatus = useSetInterestStatus();
  const deletePost = useDeleteJobPost();

  if (isLoading) {
    return (
      <Screen bg={colors.paperDim}>
        <ScreenHeader title="Job post" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.ink} style={{ marginTop: spacing.xxxl }} />
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen bg={colors.paperDim}>
        <ScreenHeader title="Job post" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <EmptyState title="Post not found" subtitle="It may have been deleted." />
        </View>
      </Screen>
    );
  }

  const expired = isPostExpired(post);
  const badge = expired
    ? { label: 'Expired', bg: colors.paperDim, fg: colors.inkMuted }
    : statusBadge(post, colors);
  const expiry = expiryLabel(post);
  const open = isPostOpen(post);
  const currentPost = post;

  function hire(interest: JobPostInterestWithProvider) {
    const name = interest.provider?.full_name ?? 'this provider';
    Alert.alert(
      `Hire ${name}?`,
      `We'll open a direct request to ${name} with your job details. Your post is marked hired once you send it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () =>
            navigation.navigate('NewRequest', {
              preferredProviderId: interest.provider_id,
              preferredProviderName: interest.provider?.full_name,
              initialCategoryId: currentPost.category_id ?? undefined,
              initialCategoryName: currentPost.category_label,
              initialDescription: `${currentPost.title}. ${currentPost.description}`.slice(0, 1000),
              jobPostId: currentPost.id,
              jobPostInterestId: interest.id,
            }),
        },
      ],
    );
  }

  function toggleShortlist(interest: JobPostInterestWithProvider) {
    setInterestStatus.mutate({
      interestId: interest.id,
      postId: currentPost.id,
      status: interest.status === 'shortlisted' ? 'pending' : 'shortlisted',
    });
  }

  function decline(interest: JobPostInterestWithProvider) {
    setInterestStatus.mutate({ interestId: interest.id, postId: currentPost.id, status: 'declined' });
  }

  function closeOrReopen() {
    // An expired post is still 'open' in the database: closing it would do
    // nothing useful, so the button reposts it instead.
    const next = isPostOpen(currentPost) ? 'closed' : 'open';
    setPostStatus.mutate(
      { postId: currentPost.id, status: next, ...(next === 'open' ? { hiredProviderId: null } : {}) },
      { onError: (e: any) => Alert.alert('Could not update the post', e?.message ?? 'Please try again.') },
    );
  }

  function confirmDelete() {
    Alert.alert('Delete this post?', 'It will be removed from every provider feed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost.mutateAsync(currentPost.id);
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Could not delete the post', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }

  const active = interests.filter((i) => i.status !== 'declined');
  const declined = interests.filter((i) => i.status === 'declined');

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Job post" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {justPosted && open ? (
          <View style={styles.liveBanner}>
            <CheckCircle2 size={20} strokeWidth={2.4} color={colors.confirm} />
            <View style={{ flex: 1 }}>
              <Text style={styles.liveTitle}>Your job is live</Text>
              <Text style={styles.liveBody}>Providers can see it on their feed now. We'll notify you when someone is interested.</Text>
            </View>
          </View>
        ) : null}

        <JobPostSummary post={post} aside={<Badge label={badge.label} bg={badge.bg} fg={badge.fg} />} />
        {expiry ? <Text style={[styles.expiry, expired && styles.expiryOver]}>{expiry}</Text> : null}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Interested providers</Text>
          <Text style={styles.sectionCount}>{active.length}</Text>
        </View>

        {interestsLoading ? (
          <ActivityIndicator color={colors.ink} />
        ) : active.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No one yet"
            subtitle={
              open
                ? 'Providers who want this job will show up here.'
                : 'This post is not taking new interest.'
            }
          />
        ) : (
          active.map((i) => (
            <InterestCard
              key={i.id}
              interest={i}
              canAct={open}
              onViewProfile={() => navigation.navigate('ProviderDetail', { providerId: i.provider_id })}
              onHire={() => hire(i)}
              onShortlist={() => toggleShortlist(i)}
              onDecline={() => decline(i)}
            />
          ))
        )}

        {declined.length ? <Text style={styles.declinedNote}>{declined.length} declined</Text> : null}

        <View style={styles.actions}>
          <Button
            title={open ? 'Close post' : expired ? 'Repost for 14 days' : 'Reopen post'}
            variant="outline"
            onPress={closeOrReopen}
            loading={setPostStatus.isPending}
          />
          <Pressable onPress={confirmDelete} style={styles.deleteBtn} accessibilityRole="button">
            <Text style={styles.deleteLabel}>Delete post</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function InterestCard({
  interest,
  canAct,
  onViewProfile,
  onHire,
  onShortlist,
  onDecline,
}: {
  interest: JobPostInterestWithProvider;
  canAct: boolean;
  onViewProfile: () => void;
  onHire: () => void;
  onShortlist: () => void;
  onDecline: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const p = interest.provider;
  return (
    <View style={styles.interestCard}>
      <Pressable style={styles.interestHead} onPress={onViewProfile} accessibilityRole="button">
        {p?.photo_url ? (
          <Image source={{ uri: p.photo_url }} style={styles.avatar} />
        ) : (
          <Avatar initials={p?.initials ?? '?'} size={40} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{p?.full_name ?? 'Provider'}</Text>
            {p?.provider_verified ? <ShieldCheck size={13} strokeWidth={2.6} color={colors.confirm} /> : null}
          </View>
          <View style={styles.nameRow}>
            <Star size={11} strokeWidth={2} color={colors.active} fill={colors.active} />
            <Text style={styles.meta}>
              {p ? ratingLabel(p) : 'New'} · {p?.provider_jobs_count ?? 0} jobs · {p?.provider_category ?? ''}
            </Text>
          </View>
        </View>
        {interest.proposed_price ? (
          <Text style={styles.price}>GHS {Number(interest.proposed_price).toLocaleString()}</Text>
        ) : null}
      </Pressable>

      {interest.message ? <Text style={styles.message}>{interest.message}</Text> : null}

      {interest.status === 'shortlisted' ? (
        <Badge label="Shortlisted" bg={colors.activeBg} fg={colors.activeDeep} />
      ) : interest.status === 'hired' ? (
        <Badge label="Hired" bg={colors.confirmBg} fg={colors.confirm} />
      ) : null}

      {canAct ? (
        <View style={styles.interestActions}>
          <Pressable style={styles.hireBtn} onPress={onHire} accessibilityRole="button">
            <Text style={styles.hireLabel}>Hire</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onShortlist} accessibilityRole="button">
            <Text style={styles.ghostLabel}>{interest.status === 'shortlisted' ? 'Unshortlist' : 'Shortlist'}</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={onDecline} accessibilityRole="button">
            <Text style={[styles.ghostLabel, { color: colors.danger }]}>Decline</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
    liveBanner: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.xxl,
      backgroundColor: colors.confirmBg,
    },
    liveTitle: { fontSize: fontSizes.md, fontFamily: fonts.extrabold, color: colors.confirmDeep },
    liveBody: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: fonts.medium, color: colors.confirmDeep, marginTop: 2 },
    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    sectionTitle: { color: colors.ink, fontSize: fontSizes.md, letterSpacing: -0.3, fontFamily: fonts.bold },
    sectionCount: { color: colors.inkFaint, fontSize: fontSizes.sm, fontFamily: fonts.bold },
    interestCard: { borderRadius: radii.xxl, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.md, ...shadow.card },
    interestHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paperDim },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    name: { flexShrink: 1, fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    meta: { flexShrink: 1, fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkMuted },
    price: { fontSize: fontSizes.md, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    message: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: fonts.regular, color: colors.ink },
    interestActions: { flexDirection: 'row', gap: spacing.sm },
    hireBtn: {
      flex: 1,
      height: 40,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.active,
    },
    hireLabel: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.white },
    ghostBtn: {
      height: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    ghostLabel: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.ink },
    expiry: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkMuted, textAlign: 'center', marginTop: -spacing.sm },
    expiryOver: { color: colors.danger },
    declinedNote: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkFaint, textAlign: 'center' },
    actions: { gap: spacing.sm, marginTop: spacing.md },
    deleteBtn: { alignSelf: 'center', paddingVertical: spacing.md },
    deleteLabel: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.danger },
  });
}
