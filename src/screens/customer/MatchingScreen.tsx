import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { useRequestOpportunities, useServiceRequest, useSimulateQuotesArriving } from '../../api/requests';
import { isApiConfigured } from '../../lib/api';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function MatchingScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const requestId: string = route.params.requestId;
  const preferredProviderName: string | undefined = route.params?.preferredProviderName;
  const { data: request } = useServiceRequest(requestId);
  const { data: opportunities } = useRequestOpportunities(requestId);
  const simulate = useSimulateQuotesArriving();
  const matchedCount = opportunities?.count ?? route.params?.matchedCount ?? 0;
  const isDirect =
    Boolean(route.params?.direct) ||
    Boolean(route.params?.preferredProviderId) ||
    Boolean(request?.preferred_provider_id);

  const matchedProviderName = (
    opportunities?.items as Array<{ profiles?: { full_name?: string } }> | undefined
  )?.[0]?.profiles?.full_name;
  const providerLabel = preferredProviderName ?? matchedProviderName;

  async function handleSimulate() {
    await simulate.mutateAsync(requestId);
    navigation.navigate('RequestsTab', { screen: 'RequestsHome' });
  }

  function goHome() {
    navigation.navigate('HomeTab', { screen: 'Home' });
  }

  function goRequests() {
    navigation.navigate('RequestsTab', { screen: 'RequestsHome' });
  }

  if (isDirect) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Request sent" onBack={goHome} />

        <View style={styles.successBody}>
          <View style={styles.successIcon}>
            <Check size={28} strokeWidth={2.4} color={colors.paper} />
          </View>
          <Text style={styles.successTitle}>Request sent</Text>
          <Text style={styles.successSubtitle}>
            {providerLabel
              ? `Sent only to ${providerLabel}. They can accept (starts the job at your budget) or decline with a reason.`
              : 'Sent to your selected provider. They can accept or decline — no open matching.'}
          </Text>

          <View style={styles.successCard}>
            <Text style={styles.successCardLabel}>DETAILS</Text>
            <Text style={styles.successCardTitle}>
              {request?.category_label ?? 'Service request'}
            </Text>
            {providerLabel ? (
              <Text style={styles.successCardMeta}>Provider · {providerLabel}</Text>
            ) : null}
            <Text style={styles.successCardMeta}>
              {request?.location_label ?? 'Accra'} · GHS {request?.budget_min}-{request?.budget_max}
            </Text>
          </View>

          <View style={styles.successActions}>
            <Button title="View my requests" onPress={goRequests} />
            <Button title="Back to home" variant="outline" onPress={goHome} />
          </View>

          <Pressable
            onPress={handleSimulate}
            disabled={simulate.isPending}
            style={({ pressed }) => [
              styles.simulateLink,
              pressed && !simulate.isPending && styles.simulateBtnPressed,
            ]}
          >
            <Text style={styles.simulateLinkLabel}>
              {simulate.isPending ? 'Sending quote…' : 'Demo: simulate provider quote'}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Finding providers" onBack={goHome} />

      <View style={styles.summaryWrap}>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {request?.category_label} · {request?.location_label}
          </Text>
          <Text style={styles.summarySub}>
            Requested just now · Budget GHS {request?.budget_min}-{request?.budget_max}
          </Text>
          {isApiConfigured() ? (
            <Text style={styles.summarySub}>
              {matchedCount > 0
                ? `${matchedCount} eligible provider${matchedCount === 1 ? '' : 's'} notified`
                : 'Matching nearby providers…'}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.icon}>
          <Search size={20} strokeWidth={1.8} color={colors.inkFaint} />
        </View>
        <Text style={styles.title}>{matchedCount > 0 ? 'Providers notified' : 'No quotes yet'}</Text>
        <Text style={styles.subtitle}>
          {matchedCount > 0
            ? 'Eligible providers nearby can now see your request and send quotes.'
            : 'Providers nearby are reviewing your request. Most reply within 30 minutes.'}
        </Text>

        <Pressable
          onPress={handleSimulate}
          disabled={simulate.isPending}
          style={({ pressed }) => [styles.simulateBtn, pressed && !simulate.isPending && styles.simulateBtnPressed]}
        >
          <Text style={styles.simulateLabel}>
            {simulate.isPending ? 'Matching...' : 'Skip ahead: 3 quotes just came in'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    summaryWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    summary: {
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      gap: 3,
    },
    summaryTitle: { color: colors.ink, fontSize: 14, fontFamily: fonts.bold },
    summarySub: { color: colors.inkMuted, fontSize: 12, fontFamily: fonts.medium },

    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
      gap: spacing.md,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: radii.pill,
      backgroundColor: colors.paperDim,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    title: { fontSize: 18, fontFamily: fonts.bold, color: colors.ink, textAlign: 'center' },
    subtitle: {
      fontSize: 14,
      lineHeight: 21,
      fontFamily: fonts.regular,
      color: colors.inkMuted,
      textAlign: 'center',
    },
    simulateBtn: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.card,
    },
    simulateBtnPressed: { opacity: 0.85 },
    simulateLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },

    successBody: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxl,
      alignItems: 'center',
      gap: spacing.md,
    },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: radii.pill,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    successTitle: {
      fontSize: 22,
      fontFamily: fonts.bold,
      color: colors.ink,
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    successSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: fonts.regular,
      color: colors.inkMuted,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
    },
    successCard: {
      alignSelf: 'stretch',
      marginTop: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      gap: 4,
    },
    successCardLabel: {
      fontSize: 10.5,
      fontFamily: fonts.extrabold,
      color: colors.inkFaint,
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    successCardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    successCardMeta: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkMuted },
    successActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
    simulateLink: { marginTop: spacing.md, paddingVertical: spacing.sm },
    simulateLinkLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, textAlign: 'center' },
  });
}
