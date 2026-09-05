import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';
import { StarRating } from './StarRating';
import type { ProviderReview } from '../api/reviews';
import { colors, fonts, radii, spacing } from '../theme';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function ReviewCard({ review }: { review: ProviderReview }) {
  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Avatar initials={review.customer?.initials ?? 'SC'} size={36} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.name}>{review.customer?.full_name ?? 'Solid Connect customer'}</Text>
          <View style={styles.metaRow}>
            <StarRating value={review.rating} size={11} />
            <Text style={styles.date}>{formatDate(review.created_at)}</Text>
          </View>
        </View>
      </View>
      {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  name: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  date: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
  comment: { fontSize: 13.5, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
});
