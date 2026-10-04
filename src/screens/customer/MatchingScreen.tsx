import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { useRequestOpportunities, useServiceRequest } from '../../api/requests';
import { isApiConfigured } from '../../lib/api';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

// Same visual language as NewRequestScreen, which hands off here: dimmed
// page, raised white cards, one large heading, actions pinned at the foot.
export function MatchingScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const requestId: string = route.params.requestId;
  const preferredProviderName: string | undefined = route.params?.preferredProviderName;
  const { data: request } = useServiceRequest(requestId);
  const { data: opportunities } = useRequestOpportunities(requestId);
  const matchedCount = opportunities?.count ?? route.params?.matchedCount ?? 0;
  const isDirect =
    Boolean(route.params?.direct) ||
    Boolean(route.params?.preferredProviderId) ||
    Boolean(request?.preferred_provider_id);

  const matchedProviderName = (
    opportunities?.items as Array<{ profiles?: { full_name?: string } }> | undefined
  )?.[0]?.profiles?.full_name;
  const providerLabel = preferredProviderName ?? matchedProviderName;

  const budgetLabel =
    request?.budget_min == null
      ? '—'
      : request.budget_max != null && request.budget_max !== request.budget_min
        ? `GHS ${request.budget_min}–${request.budget_max}`
        : `GHS ${request.budget_min}`;

  function goHome() {
    navigation.navigate('HomeTab', { screen: 'Home' });
  }

  function goRequests() {
    navigation.navigate('ActivityTab', { screen: 'ActivityHome' });
  }

  const title = isDirect ? 'Request sent' : matchedCount > 0 ? 'Providers notified' : 'Finding providers';
  const subtitle = isDirect
    ? providerLabel
      ? `Sent only to ${providerLabel}. They can accept and start at your budget, or decline with a reason.`
      : 'Sent to your selected provider. They can accept or decline.'
    : matchedCount > 0
      ? `${matchedCount} provider${matchedCount === 1 ? '' : 's'} nearby can now see your request and send quotes.`
      : 'Providers nearby are reviewing your request. Most reply within 30 minutes.';

  const nextSteps = isDirect
    ? [
        `${providerLabel ?? 'The provider'} reviews your request.`,
        'Their answer shows up in Activity.',
        'Once accepted, chat and track the job from Activity.',
      ]
    : [
        'Providers nearby review your request.',
        'Quotes show up in Activity as they arrive.',
        'Compare quotes and hire the one you like.',
      ];

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title={isDirect ? 'Request sent' : 'Finding providers'} onBack={goHome} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.statusIcon, isDirect ? styles.statusIconDone : styles.statusIconActive]}>
            {isDirect ? (
              <Check size={30} strokeWidth={2.6} color={colors.white} />
            ) : (
              <Search size={28} strokeWidth={2.2} color={colors.active} />
            )}
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your request</Text>
          <Row label="Service" value={request?.category_label ?? '—'} styles={styles} />
          {isDirect && providerLabel ? <Row label="Provider" value={providerLabel} styles={styles} /> : null}
          <Row label="Area" value={request?.location_label ?? '—'} styles={styles} />
          <Row label="Budget" value={budgetLabel} mono styles={styles} />
          {!isDirect && isApiConfigured() ? (
            <Row
              label="Status"
              value={matchedCount > 0 ? `${matchedCount} notified` : 'Matching…'}
              accent
              styles={styles}
            />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What happens next</Text>
          {nextSteps.map((text, i) => (
            <View key={text} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="View my requests" variant="active" onPress={goRequests} />
        <Button title="Back to home" variant="outline" onPress={goHome} />
      </View>
    </Screen>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Row({
  label,
  value,
  mono = false,
  accent = false,
  styles,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
  styles: Styles;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, mono && styles.rowValueMono, accent && styles.rowValueAccent]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl },

    hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, paddingHorizontal: spacing.sm },
    statusIcon: {
      width: 72,
      height: 72,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    // Still searching reads as the "active" accent; a sent direct request
    // is a confirmed state, so it takes the reserved confirm green.
    statusIconActive: { backgroundColor: colors.activeBg },
    statusIconDone: { backgroundColor: colors.confirm },
    title: {
      fontSize: 27,
      lineHeight: 33,
      fontFamily: fonts.extrabold,
      color: colors.ink,
      letterSpacing: -0.6,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16.5,
      lineHeight: 24,
      fontFamily: fonts.regular,
      color: colors.inkMuted,
      textAlign: 'center',
    },

    // Raised white card on the dimmed page - shadow does the separating.
    card: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...shadow.card,
    },
    cardTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink, paddingVertical: spacing.sm },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    rowLabel: { fontSize: 16, fontFamily: fonts.medium, color: colors.inkMuted },
    rowValue: { flexShrink: 1, fontSize: 16, fontFamily: fonts.semibold, color: colors.ink, textAlign: 'right' },
    rowValueMono: { fontFamily: fonts.mono },
    rowValueAccent: { color: colors.active },

    step: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    stepNumber: {
      width: 26,
      height: 26,
      borderRadius: radii.pill,
      backgroundColor: colors.paperDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
    stepText: { flex: 1, fontSize: 16, lineHeight: 23, fontFamily: fonts.regular, color: colors.ink, paddingTop: 1 },

    footer: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.paper,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      gap: spacing.sm,
    },
  });
}
