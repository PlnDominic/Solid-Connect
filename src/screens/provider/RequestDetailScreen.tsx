import { useState } from 'react';
import { Alert, Image, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import {
  useAcceptDirectRequest,
  useRejectDirectRequest,
  useSendQuote,
  useServiceRequest,
} from '../../api/requests';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
}

export function RequestDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const requestId: string = route.params.requestId;
  const profile = useSessionStore((s) => s.profile);
  const { data: request } = useServiceRequest(requestId);
  const sendQuote = useSendQuote();
  const acceptDirect = useAcceptDirectRequest();
  const rejectDirect = useRejectDirectRequest();
  const [price, setPrice] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  if (!request) return <Screen />;

  const title = request.category_label.split('·').pop()?.trim() ?? request.category_label;
  const isDirect =
    request.request_mode === 'DIRECT' ||
    Boolean(request.preferred_provider_id) ||
    request.status === 'awaiting_provider';
  const awaiting = request.status === 'awaiting_provider';
  const statedBudget = request.customer_budget ?? request.budget_min ?? request.budget_max;

  async function handleSendQuote() {
    if (!profile || !request) return;
    const numeric = parseInt(price, 10);
    if (!numeric || numeric <= 0) return;
    await sendQuote.mutateAsync({
      requestId: request.id,
      providerId: profile.id,
      price: numeric,
      etaLabel: 'Today, 2 hrs',
      badgeLabel: profile.provider_certified ? 'Certified' : 'Identity verified',
      badgeKind: profile.provider_certified ? 'certified' : 'verified',
    });
    navigation.navigate('Feed');
  }

  async function handleAcceptDirect() {
    try {
      const data = await acceptDirect.mutateAsync(requestId);
      const jobId = (data as { job?: { id?: string } })?.job?.id;
      if (jobId) {
        navigation.navigate('JobsTab' as never, {
          screen: 'JobDetail',
          params: { jobId },
        } as never);
      } else {
        navigation.navigate('Feed');
      }
    } catch (e: any) {
      Alert.alert('Could not accept', e?.message ?? 'Try again.');
    }
  }

  async function handleRejectDirect() {
    if (rejectReason.trim().length < 3) {
      Alert.alert('Reason needed', 'Tell the customer why you are declining (at least a few words).');
      return;
    }
    try {
      await rejectDirect.mutateAsync({ requestId, reason: rejectReason.trim() });
      navigation.navigate('Feed');
    } catch (e: any) {
      Alert.alert('Could not decline', e?.message ?? 'Try again.');
    }
  }

  return (
    <Screen>
      <ScreenHeader title={title} onBack={() => navigation.navigate('Feed')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {request.location_label} · {timeAgo(request.created_at)}
          </Text>
          <Text style={styles.summarySub}>
            {isDirect ? 'Direct request · ' : ''}
            Customer budget GHS {statedBudget}
          </Text>
          {isDirect && awaiting ? (
            <Text style={styles.directHint}>Accept to start the job at this budget, or decline with a reason.</Text>
          ) : null}
        </View>
        <Text style={styles.desc}>{request.description}</Text>

        {request.photos?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {request.photos.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.photo} />
            ))}
          </ScrollView>
        ) : null}

        {!isDirect || !awaiting ? (
          <>
            <View style={{ gap: 7 }}>
              <Text style={styles.fieldLabel}>Your price</Text>
              <View style={styles.priceField}>
                <Text style={styles.priceCurrency}>GHS</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder={String(statedBudget ?? 480)}
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="number-pad"
                  style={styles.priceInput}
                />
              </View>
            </View>

            <View style={{ gap: 7 }}>
              <Text style={styles.fieldLabel}>You can start</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyValue}>Today, 2 hrs</Text>
              </View>
            </View>
          </>
        ) : null}

        {showReject ? (
          <View style={{ gap: 7 }}>
            <Text style={styles.fieldLabel}>Reason for declining</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Not available this week / outside my service area"
              placeholderTextColor={colors.inkFaint}
              multiline
              style={styles.reasonInput}
            />
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {isDirect && awaiting ? (
          showReject ? (
            <>
              <Button
                title="Confirm decline"
                onPress={handleRejectDirect}
                loading={rejectDirect.isPending}
              />
              <Button title="Cancel" variant="outline" onPress={() => setShowReject(false)} />
            </>
          ) : (
            <>
              <Button
                title={`Accept · GHS ${statedBudget}`}
                onPress={handleAcceptDirect}
                loading={acceptDirect.isPending}
              />
              <Button title="Decline" variant="outline" onPress={() => setShowReject(true)} />
            </>
          )
        ) : (
          <Button title="Send quote" onPress={handleSendQuote} loading={sendQuote.isPending} disabled={!price} />
        )}
      </View>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.xl },
    summary: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.md,
      gap: 3,
    },
    summaryTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
    summarySub: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkMuted },
    directHint: { fontSize: 12, fontFamily: fonts.medium, color: colors.ink, marginTop: 4 },
    desc: { fontSize: 14, lineHeight: 22, fontFamily: fonts.regular, color: colors.inkMuted },
    photoRow: { gap: spacing.sm },
    photo: { width: 96, height: 96, borderRadius: radii.md, backgroundColor: colors.paperDim },
    fieldLabel: { fontSize: 12.5, fontFamily: fonts.semibold, color: colors.inkFaint, letterSpacing: 0.2 },
    priceField: {
      height: 52,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.ink,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
    },
    priceCurrency: { color: colors.inkFaint, marginRight: 6, fontSize: 16, fontFamily: fonts.medium },
    priceInput: { flex: 1, fontSize: 16, fontFamily: fonts.medium, color: colors.ink },
    reasonInput: {
      minHeight: 88,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.md,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
    },
    readonlyField: {
      height: 52,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    readonlyValue: { fontSize: 15, fontFamily: fonts.medium, color: colors.ink },
    footer: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      gap: spacing.sm,
    },
  });
}
