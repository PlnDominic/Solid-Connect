import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRefreshSubscription, useSubscription, useSubscriptionCheckout } from '../../api/subscription';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function SubscriptionScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: sub, isLoading } = useSubscription();
  const checkout = useSubscriptionCheckout();
  const refresh = useRefreshSubscription();
  const [error, setError] = useState<string | null>(null);

  // Back from Hubtel: confirm whatever checkout was pending.
  useFocusEffect(
    useCallback(() => {
      refresh.mutate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function handleSubscribe() {
    setError(null);
    try {
      const { checkoutUrl } = await checkout.mutateAsync();
      await Linking.openURL(checkoutUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not start Hubtel checkout.');
    }
  }

  const expires = sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : null;
  const headline = !sub
    ? ''
    : sub.active
      ? `Active until ${expires}`
      : sub.trialUsed
        ? 'Subscription needed'
        : 'Your first job is free';
  const note = !sub
    ? ''
    : sub.active
      ? 'You can send quotes and accept direct requests. Renewing adds a full year on top of the time you have left.'
      : sub.trialUsed
        ? 'Your free job is used. Subscribe to keep sending quotes and accepting direct requests. Jobs already in progress are not affected.'
        : 'Take your first job on us. After that, a yearly subscription keeps you taking new work.';

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Subscription" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {isLoading || !sub ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.headline}>{headline}</Text>
              <Text style={styles.price}>
                {sub.currency} {sub.price} <Text style={styles.per}>/ {sub.periodDays === 365 ? 'year' : `${sub.periodDays} days`}</Text>
              </Text>
              <Text style={styles.note}>{note}</Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={sub.active ? 'Renew with Hubtel' : 'Subscribe with Hubtel'}
              onPress={handleSubscribe}
              loading={checkout.isPending}
            />
            <Button title="I've paid - refresh" variant="outline" onPress={() => refresh.mutate()} loading={refresh.isPending} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
    card: { borderRadius: radii.xxl, backgroundColor: colors.card, padding: spacing.xl, gap: 8 },
    headline: { color: colors.ink, fontSize: fontSizes.lg, fontFamily: fonts.extrabold },
    price: { color: colors.ink, fontSize: fontSizes.display, fontFamily: fonts.extrabold },
    per: { fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.inkFaint },
    note: { color: colors.inkFaint, fontSize: fontSizes.md, fontFamily: fonts.medium },
    error: { color: colors.danger ?? '#c0392b', fontSize: fontSizes.md, fontFamily: fonts.medium },
  });
}
