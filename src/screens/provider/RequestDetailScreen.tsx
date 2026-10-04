import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { friendlyQuoteError, useMyQuote, useRespondToCounter, useReviseQuote } from '../../api/quotes';
import {
  useAcceptDirectRequest,
  useRejectDirectRequest,
  useSendQuote,
  useServiceRequest,
} from '../../api/requests';
import { Button } from '../../components/Button';
import { ImageViewer, useImageViewer } from '../../components/ImageViewer';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SlotPicker } from '../../components/SlotPicker';
import { haptics } from '../../lib/haptics';
import { buildQuoteDraft, etaLabelFor, MAX_QUOTE_ITEMS, type DraftRow } from '../../lib/quoteLogic';
import { quoteBadgeFor } from '../../lib/quoteBadge';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
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
  const { data: myQuote } = useMyQuote(requestId, profile?.id);
  const reviseQuote = useReviseQuote();
  const respondCounter = useRespondToCounter();
  const [price, setPrice] = useState('');
  const [rows, setRows] = useState<DraftRow[]>([{ label: '', amount: '' }]);
  const [note, setNote] = useState('');
  const [proposedStart, setProposedStart] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [prefilledKey, setPrefilledKey] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const imageViewer = useImageViewer();

  // Editing an already-sent quote starts from what was sent.
  // Keyed on the revision, so a change that bumps it (e.g. accepting a
  // counter-offer) refills the form with the new price and breakdown.
  useEffect(() => {
    if (!myQuote) return;
    const key = `${myQuote.id}:${myQuote.revision ?? 1}`;
    if (prefilledKey === key) return;
    setPrice(String(myQuote.price));
    setRows(myQuote.items?.length ? myQuote.items.map((i) => ({ label: i.label, amount: String(i.amount) })) : [{ label: '', amount: '' }]);
    setNote(myQuote.note ?? '');
    setProposedStart(myQuote.proposed_start ?? null);
    setPrefilledKey(key);
  }, [myQuote, prefilledKey]);

  if (!request) return <Screen />;

  const title = request.category_label.split('·').pop()?.trim() ?? request.category_label;
  const isDirect =
    request.request_mode === 'DIRECT' ||
    Boolean(request.preferred_provider_id) ||
    request.status === 'awaiting_provider';
  const awaiting = request.status === 'awaiting_provider';
  const statedBudget = request.customer_budget ?? request.budget_min ?? request.budget_max;

  const quoteOpen = !myQuote || myQuote.status === 'sent';
  const hasBreakdown = rows.some((r) => r.label.trim() || r.amount.trim());
  const breakdownTotal = rows.reduce((s, r) => s + (parseInt(r.amount.replace(/[^\d]/g, ''), 10) || 0), 0);

  function updateRow(i: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSendQuote() {
    if (!profile || !request) return;
    const draft = buildQuoteDraft(rows, price);
    if (!draft.ok) {
      setFormError(draft.error);
      return;
    }
    setFormError(null);
    try {
      if (myQuote) {
        await reviseQuote.mutateAsync({
          quoteId: myQuote.id,
          price: draft.price,
          items: draft.items,
          note: note.trim(),
          proposedStart,
          etaLabel: etaLabelFor(proposedStart),
        });
      } else {
        await sendQuote.mutateAsync({
          requestId: request.id,
          providerId: profile.id,
          price: draft.price,
          etaLabel: etaLabelFor(proposedStart),
          ...quoteBadgeFor(profile),
          note: note.trim(),
          items: draft.items,
          proposedStart,
        });
      }
      haptics.success();
      navigation.navigate('Feed');
    } catch (e) {
      setFormError(friendlyQuoteError(e));
    }
  }

  async function handleCounterResponse(accept: boolean) {
    if (!myQuote) return;
    try {
      await respondCounter.mutateAsync({ quoteId: myQuote.id, accept });
      if (accept) haptics.success();
    } catch (e) {
      Alert.alert('Could not answer', friendlyQuoteError(e));
    }
  }

  async function handleAcceptDirect() {
    try {
      const data = await acceptDirect.mutateAsync(requestId);
      haptics.success();
      const jobId = (data as { job?: { id?: string } })?.job?.id;
      if (jobId) {
        navigation.navigate('ActivityTab' as never, {
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
    // A dimmed page so the white cards lift off it (see shadow.card).
    <Screen bg={colors.paperDim}>
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
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Job details</Text>
          <Text style={styles.desc}>{request.description}</Text>
          {request.photos?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {request.photos.map((uri, i) => (
                <Pressable
                  key={uri}
                  onPress={() => imageViewer.open(request.photos, i)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Job photo ${i + 1} of ${request.photos.length}`}
                >
                  <Image source={{ uri }} style={styles.photo} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {myQuote?.status === 'declined' ? (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>The customer declined this quote</Text>
            {myQuote.decline_reason ? <Text style={styles.summarySub}>{myQuote.decline_reason}</Text> : null}
          </View>
        ) : myQuote?.status === 'accepted' ? (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>The customer accepted your quote</Text>
            <Text style={styles.summarySub}>Find the job under the Work tab.</Text>
          </View>
        ) : null}

        {myQuote?.status === 'sent' && myQuote.counter_price ? (
          <View style={styles.counterCard}>
            <Text style={styles.counterTitle}>Counter-offer: GHS {myQuote.counter_price.toLocaleString()}</Text>
            <Text style={styles.summarySub}>
              Your quote is GHS {myQuote.price.toLocaleString()}.{myQuote.counter_note ? ` They said: “${myQuote.counter_note}”` : ''}
            </Text>
            <Text style={styles.summarySub}>Accepting removes the price breakdown; you can add a new one afterwards.</Text>
            <View style={styles.counterActions}>
              <Button
                title="Accept"
                onPress={() => handleCounterResponse(true)}
                loading={respondCounter.isPending}
                style={styles.counterBtn}
              />
              <Button
                title="Decline"
                variant="outline"
                onPress={() => handleCounterResponse(false)}
                disabled={respondCounter.isPending}
                style={styles.counterBtn}
              />
            </View>
            <Text style={styles.summarySub}>Or set a new price below to update your quote.</Text>
          </View>
        ) : null}

        {(!isDirect || !awaiting) && quoteOpen ? (
          <>
            <View style={[styles.card, styles.cardFields]}>
              <Text style={styles.cardTitle}>Your quote</Text>
              <Text style={styles.fieldLabel}>{hasBreakdown ? 'Price breakdown' : 'Your price'}</Text>
              {hasBreakdown ? (
                <View style={styles.priceField}>
                  <Text style={styles.priceCurrency}>GHS</Text>
                  <Text style={styles.priceInput}>{breakdownTotal.toLocaleString()} total</Text>
                </View>
              ) : (
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
              )}
              {rows.map((r, i) => (
                <View key={i} style={styles.itemRow}>
                  <TextInput
                    value={r.label}
                    onChangeText={(t) => updateRow(i, { label: t })}
                    placeholder={i === 0 ? 'e.g. Labour' : 'e.g. Materials'}
                    placeholderTextColor={colors.inkFaint}
                    maxLength={60}
                    style={[styles.itemInput, { flex: 1 }]}
                  />
                  <TextInput
                    value={r.amount}
                    onChangeText={(t) => updateRow(i, { amount: t })}
                    placeholder="GHS"
                    placeholderTextColor={colors.inkFaint}
                    keyboardType="number-pad"
                    style={[styles.itemInput, styles.itemAmount]}
                  />
                  {rows.length > 1 ? (
                    <Pressable
                      onPress={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Remove this line"
                    >
                      <X size={16} strokeWidth={2.4} color={colors.inkFaint} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {rows.length < MAX_QUOTE_ITEMS ? (
                <Pressable
                  onPress={() => setRows((prev) => [...prev, { label: '', amount: '' }])}
                  style={styles.addRow}
                  accessibilityRole="button"
                >
                  <Plus size={16} strokeWidth={2.4} color={colors.inkMuted} />
                  <Text style={styles.addRowText}>Add a line item</Text>
                </Pressable>
              ) : null}
              <Text style={styles.hint}>Optional. With line items, the total is worked out for you.</Text>
            </View>

            {profile ? (
              <View style={styles.card}>
                <SlotPicker
                  providerId={profile.id}
                  value={proposedStart}
                  onChange={setProposedStart}
                  label="You can start"
                  optionalHint="Optional - leave blank to stay flexible."
                />
              </View>
            ) : null}

            <View style={[styles.card, styles.cardFields]}>
              <Text style={styles.fieldLabel}>Note to the customer</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="What's included, materials, anything they should know"
                placeholderTextColor={colors.inkFaint}
                multiline
                maxLength={500}
                style={styles.reasonInput}
              />
            </View>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          </>
        ) : null}

        {showReject ? (
          <View style={[styles.card, styles.cardFields]}>
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
        ) : quoteOpen ? (
          <Button
            title={myQuote ? 'Update quote' : 'Send quote'}
            onPress={handleSendQuote}
            loading={sendQuote.isPending || reviseQuote.isPending}
            disabled={!hasBreakdown && !price}
          />
        ) : null}
      </View>
      <ImageViewer visible={imageViewer.visible} images={imageViewer.images} initialIndex={imageViewer.index} onClose={imageViewer.close} />
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
    // Every section is a white card lifted off the paperDim page.
    card: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadow.card,
    },
    cardFields: { gap: spacing.md },
    cardTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.ink },
    summary: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: 6,
      ...shadow.card,
    },
    summaryTitle: { fontSize: fontSizes.lg, lineHeight: 24, fontFamily: fonts.bold, color: colors.ink },
    summarySub: { fontSize: fontSizes.md, lineHeight: 22, fontFamily: fonts.medium, color: colors.inkMuted },
    directHint: { fontSize: fontSizes.md, lineHeight: 22, fontFamily: fonts.medium, color: colors.ink, marginTop: 4 },
    desc: { fontSize: fontSizes.md, lineHeight: 25, fontFamily: fonts.regular, color: colors.ink },
    photoRow: { gap: spacing.sm, paddingTop: spacing.xs },
    photo: { width: 112, height: 112, borderRadius: radii.lg, backgroundColor: colors.paperDim },
    fieldLabel: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkMuted, letterSpacing: 0.2 },
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
    priceCurrency: { color: colors.inkMuted, marginRight: 6, fontSize: fontSizes.lg, fontFamily: fonts.medium },
    priceInput: { flex: 1, fontSize: fontSizes.lg, fontFamily: fonts.semibold, color: colors.ink },
    reasonInput: {
      minHeight: 100,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.md,
      fontSize: fontSizes.md,
      lineHeight: 22,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    itemInput: {
      height: 48,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      fontSize: fontSizes.md,
      fontFamily: fonts.medium,
      color: colors.ink,
    },
    itemAmount: { width: 100 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    addRowText: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.inkMuted },
    hint: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: fonts.medium, color: colors.inkMuted },
    formError: { fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.danger },
    counterCard: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.pendingBg,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadow.card,
    },
    counterTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.ink },
    counterActions: { flexDirection: 'row', gap: spacing.sm },
    counterBtn: { flex: 1, height: 44 },
    readonlyField: {
      height: 52,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    readonlyValue: { fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.ink },
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
