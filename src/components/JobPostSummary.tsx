import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, MapPin, Users, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { formatJobPostBudget, formatJobPostStart, postedAgo, type JobPost } from '../api/jobPosts';
import { fonts, fontSizes, radii, shadow, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/** The body of a job post, shared by the customer's and the provider's view. */
export function JobPostSummary({ post, aside }: { post: JobPost; aside?: ReactNode }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.category}>{post.category_label.toUpperCase()}</Text>
        {aside}
      </View>
      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.posted}>Posted {postedAgo(post.created_at)}</Text>

      <View style={styles.facts}>
        <Fact icon={Wallet} label="Budget" value={formatJobPostBudget(post)} styles={styles} color={colors.inkMuted} />
        <Fact icon={CalendarDays} label="Start" value={formatJobPostStart(post)} styles={styles} color={colors.inkMuted} />
        <Fact icon={MapPin} label="Area" value={post.location_label} styles={styles} color={colors.inkMuted} />
        <Fact
          icon={Users}
          label="Interested"
          value={`${post.interest_count} provider${post.interest_count === 1 ? '' : 's'}`}
          styles={styles}
          color={colors.inkMuted}
        />
      </View>

      <Text style={styles.description}>{post.description}</Text>

      {post.photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {post.photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.photo} accessibilityLabel="Job photo" />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  styles,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  color: string;
}) {
  return (
    <View style={styles.fact}>
      <Icon size={14} strokeWidth={2.2} color={color} />
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: { borderRadius: radii.xxxl, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.sm, ...shadow.card },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    category: { fontSize: fontSizes.xs, fontFamily: fonts.extrabold, letterSpacing: 0.8, color: colors.active },
    title: { fontSize: fontSizes.xl, lineHeight: 26, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.3 },
    posted: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    facts: {
      marginTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    fact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    factLabel: { width: 84, fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkMuted },
    factValue: { flex: 1, textAlign: 'right', fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.ink },
    description: { fontSize: fontSizes.md, lineHeight: 23, fontFamily: fonts.regular, color: colors.ink, marginTop: spacing.sm },
    photos: { gap: spacing.sm, paddingTop: spacing.sm },
    photo: { width: 120, height: 120, borderRadius: radii.xl, backgroundColor: colors.paperDim },
  });
}
