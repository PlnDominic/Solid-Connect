import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { isPostExpired, isPostOpen, useExpressInterest, useJobPost, useMyJobPostInterests, useWithdrawInterest } from '../../api/jobPosts';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { JobPostSummary } from '../../components/JobPostSummary';
import { ReportSheet } from '../../components/ReportSheet';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { haptics } from '../../lib/haptics';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const MAX_MESSAGE = 600;

/** A provider's view of one job board post: the details plus "I'm interested". */
export function JobPostScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const postId: string = route?.params?.postId;
  const { data: post, isLoading } = useJobPost(postId);
  const { data: myInterests } = useMyJobPostInterests(profile?.id ?? null);
  const mine = myInterests?.get(postId) ?? null;
  const expressInterest = useExpressInterest();
  const withdraw = useWithdrawInterest();

  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState('');
  const [priceText, setPriceText] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mine) return;
    setMessage(mine.message ?? '');
    setPriceText(mine.proposed_price ? String(Math.round(Number(mine.proposed_price))) : '');
  }, [mine?.id]);

  async function submit() {
    if (!profile || !post) return;
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setError('Write a short note of at least 10 characters so the customer knows why you are a fit.');
      return;
    }
    const price = parseInt(priceText.replace(/[^\d]/g, ''), 10);
    setError(null);
    try {
      await expressInterest.mutateAsync({
        postId: post.id,
        providerId: profile.id,
        message: trimmed,
        proposedPrice: Number.isFinite(price) && price > 0 ? price : null,
      });
      haptics.success();
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send your interest. Please try again.');
    }
  }

  function confirmWithdraw() {
    if (!profile || !post) return;
    Alert.alert('Withdraw your interest?', 'The customer will no longer see you on this post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () =>
          withdraw.mutate(
            { postId: post.id, providerId: profile.id },
            { onError: (e: any) => Alert.alert('Could not withdraw', e?.message ?? 'Please try again.') },
          ),
      },
    ]);
  }

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
          <EmptyState title="Post not available" subtitle="The customer may have closed or deleted it." />
        </View>
      </Screen>
    );
  }

  const open = isPostOpen(post);
  const showForm = open && (!mine || editing);

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Job post" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <JobPostSummary post={post} />

        {!open ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {isPostExpired(post)
                ? 'This post has expired and is no longer taking interest.'
                : post.status === 'hired'
                ? post.hired_provider_id === profile?.id
                  ? 'The customer chose you for this job. Look out for their direct request.'
                  : 'The customer has hired someone for this job.'
                : 'This post is closed to new interest.'}
            </Text>
          </View>
        ) : null}

        {mine && !editing ? (
          <View style={styles.sentCard}>
            <View style={styles.sentHead}>
              <CheckCircle2 size={18} strokeWidth={2.4} color={colors.confirm} />
              <Text style={styles.sentTitle}>Interest sent</Text>
              {mine.status === 'shortlisted' ? <Text style={styles.shortlisted}>Shortlisted</Text> : null}
              {mine.status === 'declined' ? <Text style={styles.declined}>Not selected</Text> : null}
            </View>
            <Text style={styles.sentMessage}>{mine.message}</Text>
            {mine.proposed_price ? (
              <Text style={styles.sentPrice}>Your price: GHS {Number(mine.proposed_price).toLocaleString()}</Text>
            ) : null}
            {open ? (
              <View style={styles.sentActions}>
                <Pressable style={styles.ghostBtn} onPress={() => setEditing(true)} accessibilityRole="button">
                  <Text style={styles.ghostLabel}>Edit</Text>
                </Pressable>
                <Pressable style={styles.ghostBtn} onPress={confirmWithdraw} accessibilityRole="button">
                  <Text style={[styles.ghostLabel, { color: colors.danger }]}>Withdraw</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{mine ? 'Update your interest' : "I'm interested"}</Text>
            <Text style={styles.fieldLabel}>NOTE TO THE CUSTOMER</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              onFocus={() => setFocused('message')}
              onBlur={() => setFocused(null)}
              multiline
              maxLength={MAX_MESSAGE}
              placeholder="Say why you are a good fit, when you could start, anything you would need to know."
              placeholderTextColor={colors.inkFainter}
              style={[styles.textarea, focused === 'message' && styles.inputFocused]}
              accessibilityLabel="Note to the customer"
            />
            <Text style={styles.counter}>
              {message.length}/{MAX_MESSAGE}
            </Text>

            <Text style={styles.fieldLabel}>YOUR PRICE (OPTIONAL)</Text>
            <View style={[styles.priceField, focused === 'price' && styles.inputFocused]}>
              <Text style={styles.priceCurrency}>GHS</Text>
              <TextInput
                value={priceText}
                onChangeText={(v) => setPriceText(v.replace(/[^\d]/g, ''))}
                onFocus={() => setFocused('price')}
                onBlur={() => setFocused(null)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.inkFainter}
                style={styles.priceInput}
                accessibilityLabel="Your price in Ghana cedis"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title={mine ? 'Save changes' : 'Send interest'}
              variant="active"
              onPress={submit}
              loading={expressInterest.isPending}
            />
            {mine ? (
              <Pressable onPress={() => setEditing(false)} style={styles.cancel} accessibilityRole="button">
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable onPress={() => setReporting(true)} style={styles.reportBtn} accessibilityRole="button">
          <Text style={styles.reportLabel}>Report this post</Text>
        </Pressable>
      </ScrollView>

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        reportedId={post.customer_id}
        reportedName="this customer"
        context="job_post"
        jobPostId={post.id}
      />
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
    notice: { borderRadius: radii.xxl, backgroundColor: colors.pendingBg, padding: spacing.lg },
    noticeText: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: fonts.semibold, color: colors.pending },
    sentCard: { borderRadius: radii.xxl, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.sm, ...shadow.card },
    sentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sentTitle: { flex: 1, fontSize: fontSizes.md, fontFamily: fonts.extrabold, color: colors.confirm },
    shortlisted: { fontSize: fontSizes.xs, fontFamily: fonts.bold, color: colors.active },
    declined: { fontSize: fontSizes.xs, fontFamily: fonts.bold, color: colors.inkFaint },
    sentMessage: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: fonts.regular, color: colors.ink },
    sentPrice: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.ink },
    sentActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    ghostBtn: {
      height: 38,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    ghostLabel: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.ink },
    formCard: { borderRadius: radii.xxxl, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.sm, ...shadow.card },
    formTitle: { fontSize: fontSizes.lg, fontFamily: fonts.extrabold, color: colors.ink, marginBottom: spacing.xs },
    fieldLabel: { fontSize: fontSizes.xs, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6, marginTop: spacing.sm },
    textarea: {
      minHeight: 120,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.hairline,
      padding: spacing.md,
      fontSize: fontSizes.md,
      lineHeight: 22,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
    },
    inputFocused: { borderColor: colors.active, borderWidth: 1.5 },
    counter: { alignSelf: 'flex-end', fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    priceField: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.hairline,
      marginBottom: spacing.sm,
    },
    priceCurrency: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.inkFaint },
    priceInput: { flex: 1, fontSize: fontSizes.xl, fontFamily: fonts.mono, color: colors.ink, padding: 0 },
    error: { fontSize: fontSizes.sm, lineHeight: 20, fontFamily: fonts.semibold, color: colors.danger },
    reportBtn: { alignSelf: 'center', paddingVertical: spacing.md },
    reportLabel: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkFaint, textDecorationLine: 'underline' },
    cancel: { alignSelf: 'center', paddingVertical: spacing.sm },
    cancelLabel: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.inkMuted },
  });
}
