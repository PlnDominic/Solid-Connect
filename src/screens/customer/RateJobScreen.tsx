import { useState } from 'react';
import { Star } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, TextInput, StyleSheet } from 'react-native';
import { useJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useSubmitReview } from '../../api/reviews';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

const COMMENT_LIMIT = 500;

export function RateJobScreen({ navigation, route }: { navigation: any; route: any }) {
  const jobId: string = route.params.jobId;
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: provider } = useProvider(job?.provider_id);
  const submitReview = useSubmitReview();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  if (!job) return <Screen edges={['top']} />;

  async function handleSubmit() {
    if (!job || !profile || rating === 0) return;
    await submitReview.mutateAsync({ jobId: job.id, providerId: job.provider_id, customerId: profile.id, rating, comment });
    navigation.navigate('JobsHome');
  }

  return (
    <Screen>
      <ScreenHeader title="Rate this job" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.peerCard}>
          <Avatar initials={provider?.initials ?? ''} size={44} />
          <View style={{ gap: 3 }}>
            <Text style={styles.peerName}>{provider?.full_name}</Text>
            <Text style={styles.peerMeta}>{job.title} · GHS {job.price}</Text>
          </View>
        </View>

        <View style={styles.rateCard}>
          <Text style={styles.question}>How was the work?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Star
                  size={34}
                  strokeWidth={1.8}
                  color={n <= rating ? colors.active : colors.hairlineStrong}
                  fill={n <= rating ? colors.active : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingHint}>
            {rating === 0 ? 'Tap a star to rate' : rating >= 4 ? 'Great — this builds their record' : rating === 3 ? 'Acceptable' : 'We take low ratings seriously'}
          </Text>
        </View>

        <View style={styles.commentCard}>
          <Text style={styles.commentLabel}>ADD A NOTE (OPTIONAL)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={(text) => setComment(text.slice(0, COMMENT_LIMIT))}
            placeholder="What went well? Would you hire them again?"
            placeholderTextColor={colors.inkFaint}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{comment.length}/{COMMENT_LIMIT}</Text>
        </View>

        <Button title="Submit rating" onPress={handleSubmit} disabled={rating === 0} loading={submitReview.isPending} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  peerCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  peerName: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  peerMeta: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
  rateCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  question: { fontSize: 16.5, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.2 },
  starsRow: { flexDirection: 'row', gap: 10 },
  ratingHint: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
  commentCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  commentLabel: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
  commentInput: {
    minHeight: 110,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    paddingVertical: spacing.sm,
  },
  counter: { fontSize: 11, fontFamily: fonts.medium, color: colors.inkFaint, alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
});
