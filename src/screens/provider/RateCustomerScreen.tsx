import { useState } from 'react';
import { Star } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, TextInput, StyleSheet } from 'react-native';
import { useJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { useSubmitCustomerReview } from '../../api/reviews';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Provider → customer rating, the mirror of the customer's RateJobScreen
 * (two-sided reviews, 0062). Same stars/comment UI against the customer's
 * avatar; writes a customer_reviews row whose trigger keeps
 * profiles.customer_rating current.
 */

const COMMENT_LIMIT = 500;

export function RateCustomerScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const jobId: string = route.params.jobId;
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: customer } = useProvider(job?.customer_id);
  const submitReview = useSubmitCustomerReview();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  if (!job) return <Screen edges={['top']} />;

  async function handleSubmit() {
    if (!job || !profile || rating === 0) return;
    await submitReview.mutateAsync({
      jobId: job.id,
      providerId: profile.id,
      customerId: job.customer_id,
      rating,
      comment,
    });
    navigation.navigate('ActivityHome');
  }

  return (
    <Screen>
      <ScreenHeader title="Rate your customer" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.peerCard}>
          <Avatar initials={customer?.initials ?? ''} size={44} photoUrl={customer?.photo_url} />
          <View style={{ gap: 3 }}>
            <Text style={styles.peerName} numberOfLines={1}>{customer?.full_name}</Text>
            <Text style={styles.peerMeta}>{job.title} · GHS {job.price}</Text>
          </View>
        </View>

        <View style={styles.rateCard}>
          <Text style={styles.question}>How were they?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Star
                  size={34}
                  strokeWidth={1.8}
                  color={n <= rating ? colors.ink : colors.hairlineStrong}
                  fill={n <= rating ? colors.ink : 'transparent'}
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
            placeholder="Were they responsive? Was the site accessible?"
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

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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
    peerName: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.ink },
    peerMeta: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    rateCard: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
    },
    question: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.2 },
    starsRow: { flexDirection: 'row', gap: 10 },
    ratingHint: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    commentCard: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    commentLabel: { fontSize: fontSizes.xs, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    commentInput: {
      minHeight: 110,
      fontSize: fontSizes.sm,
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
    counter: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint, alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
  });
}
