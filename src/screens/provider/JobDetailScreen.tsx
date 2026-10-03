import { useState } from 'react';
import { ChevronLeft, MapPin, MessageCircle, Phone, Receipt, ShieldAlert, Siren } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useFinishJob, useJob, useJobCheckIn, useStartJob } from '../../api/jobs';
import { useProvider } from '../../api/marketplace';
import { getOrCreateThread } from '../../api/chat';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { JobPhaseTracker } from '../../components/JobPhaseTracker';
import { JobQuickActions, type JobQuickAction } from '../../components/JobQuickActions';
import { JobManageSection } from '../../components/JobManageSection';
import { JobTrackingCard } from '../../components/JobTrackingCard';
import { SafetySheet } from '../../components/SafetySheet';
import { Screen } from '../../components/Screen';
import { useReportJobLocation } from '../../hooks/useReportJobLocation';
import { JOB_STATUS_META, jobStatusHint, jobStatusLabel, jobStatusToneColors, jobStatusToneIcon } from '../../lib/jobStatus';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function JobDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const jobId: string = route.params.jobId;
  const profile = useSessionStore((s) => s.profile);
  const { data: job } = useJob(jobId);
  const { data: customer } = useProvider(job?.customer_id);
  const startJob = useStartJob();
  const finishJob = useFinishJob();
  const markEnRoute = useJobCheckIn('en_route');
  const markArrived = useJobCheckIn('arrived');
  useReportJobLocation(job);
  const [showSafety, setShowSafety] = useState(false);

  if (!job) return <Screen edges={['top']} />;

  async function handleMessage() {
    if (!profile || !job) return;
    const thread = await getOrCreateThread({
      jobId: job.id,
      requestId: job.request_id,
      customerId: job.customer_id,
      providerId: profile.id,
      asRole: 'provider',
    });
    navigation.navigate('ChatTab', {
      screen: 'ChatThread',
      params: { threadId: thread.id, peerId: job.customer_id },
    });
  }

  function handleCall() {
    const phone = customer?.phone;
    if (!customer || !phone) {
      Alert.alert('Phone number unavailable', 'No phone number is registered for this customer.');
      return;
    }
    Alert.alert(
      `Call ${customer.full_name}?`,
      `Dial ${phone} to coordinate directions or job details directly. Standard cellular rates apply.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            const cleaned = phone.replace(/[^\d+]/g, '');
            Linking.openURL(`tel:${cleaned}`).catch(() => {
              Alert.alert('Unable to dial', 'Your device could not open the phone dialer.');
            });
          },
        },
      ],
    );
  }

  async function handleStart() {
    try {
      await startJob.mutateAsync(job!);
    } catch (e: any) {
      Alert.alert('Could not start', e?.message ?? 'Try again.');
    }
  }

  async function handleCheckIn(mutation: typeof markEnRoute) {
    try {
      await mutation.mutateAsync(job!);
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? 'Try again.');
    }
  }

  // Optional steps before "Start work": tell the customer you're coming,
  // then that you're there. Skipping them never blocks starting the job.
  const checkIn =
    job.status !== 'accepted' || job.arrived_at
      ? null
      : job.en_route_at
        ? { title: "I've arrived", onPress: () => handleCheckIn(markArrived), loading: markArrived.isPending }
        : { title: "I'm on my way", onPress: () => handleCheckIn(markEnRoute), loading: markEnRoute.isPending };

  async function handleFinish() {
    try {
      await finishJob.mutateAsync(job!);
    } catch (e: any) {
      Alert.alert('Could not finish', e?.message ?? 'Try again.');
    }
  }

  const primaryCta =
    job.status === 'accepted'
      ? {
          title: 'Start work',
          onPress: handleStart,
          loading: startJob.isPending,
          disabled: false,
          variant: 'primary' as const,
        }
      : job.status === 'in_progress'
        ? {
            title: 'Mark finished',
            onPress: handleFinish,
            loading: finishJob.isPending,
            disabled: false,
            // The one moment the provider actually completes an action on
            // this screen - the brand-orange "active" variant, same accent
            // as the header, instead of the plain ink primary the other,
            // less consequential states use.
            variant: 'active' as const,
          }
        : job.status === 'awaiting_completion_confirmation'
          ? {
              title: 'Waiting for customer',
              onPress: () => {},
              loading: false,
              disabled: true,
              variant: 'primary' as const,
            }
          : {
              title: job.status === 'cancelled' ? 'Job cancelled' : 'Completed',
              onPress: () => {},
              loading: false,
              disabled: true,
              variant: 'primary' as const,
            };

  const quickActions: JobQuickAction[] = [
    { key: 'message', label: 'Message', icon: MessageCircle, onPress: handleMessage },
    ...(job.status !== 'completed' && job.status !== 'cancelled' && customer?.phone
      ? [{ key: 'call', label: 'Call', icon: Phone, onPress: handleCall }]
      : []),
    ...(job.status === 'completed'
      ? [{ key: 'receipt', label: 'Receipt', icon: Receipt, onPress: () => navigation.navigate('Receipt', { jobId: job.id }) }]
      : []),
    ...(job.status !== 'completed' && job.status !== 'cancelled'
      ? [{ key: 'safety', label: 'Safety', icon: Siren, onPress: () => setShowSafety(true), tone: 'danger' as const }]
      : []),
    { key: 'dispute', label: 'Dispute', icon: ShieldAlert, onPress: () => navigation.navigate('Dispute', { jobId: job.id }), tone: 'danger' },
  ];

  const statusTone = JOB_STATUS_META[job.status].tone;
  const statusColors = jobStatusToneColors(statusTone, colors);
  const StatusIcon = jobStatusToneIcon(statusTone);

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.navigate('JobsHome')}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={colors.white} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {job.title}
          </Text>
        </View>
        <View style={styles.peerRow}>
          <Avatar initials={customer?.initials ?? ''} photoUrl={customer?.photo_url} size={44} dim fg={colors.white} />
          <View style={{ gap: 2 }}>
            <Text style={styles.peerName}>{customer?.full_name}</Text>
            <Text style={styles.peerMeta}>{customer?.area}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={[styles.progressIcon, { backgroundColor: statusColors.bg }]}>
              <StatusIcon size={18} strokeWidth={2.2} color={statusColors.fg} />
            </View>
            <Text style={[styles.progressLabel, { color: statusColors.fg }]}>{jobStatusLabel(job.status, 'provider')}</Text>
            <Text style={styles.progressStep}>GHS {job.price.toLocaleString()}</Text>
          </View>
          <JobPhaseTracker status={job.status} tint={statusColors.fg} />
          <Text style={styles.progressNote}>{jobStatusHint(job.status, 'provider')}</Text>
        </View>

        <JobTrackingCard job={job} viewerRole="provider" onMessage={handleMessage} />

        <View style={styles.detailsCard}>
          <Text style={styles.detailsLabel}>DETAILS</Text>
          <Text style={styles.detailsValue}>
            {job.title} · GHS {job.price.toLocaleString()} fixed price
          </Text>
          <View style={styles.detailsLocationRow}>
            <MapPin size={13} strokeWidth={1.8} color={colors.inkFaint} />
            <Text style={styles.detailsSub}>{job.location_label}</Text>
          </View>
        </View>

        {profile ? <JobManageSection job={job} role="provider" userId={profile.id} /> : null}

        <JobQuickActions actions={quickActions} />
      </ScrollView>

      <View style={styles.footer}>
        {checkIn ? (
          <Button
            title={checkIn.title}
            onPress={checkIn.onPress}
            loading={checkIn.loading}
            variant="outline"
            style={{ marginBottom: spacing.sm }}
          />
        ) : null}
        <Button
          title={primaryCta.title}
          onPress={primaryCta.onPress}
          loading={primaryCta.loading}
          disabled={primaryCta.disabled}
          variant={primaryCta.variant}
        />
      </View>

      <SafetySheet visible={showSafety} onClose={() => setShowSafety(false)} job={job} peerName={customer?.full_name} />
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    header: {
      backgroundColor: colors.active,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      gap: spacing.lg,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    back: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    headerTitle: { flex: 1, color: colors.white, fontSize: 18, fontFamily: fonts.bold, letterSpacing: -0.3 },
    peerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    peerName: { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
    peerMeta: { color: colors.white, opacity: 0.7, fontSize: 12, fontFamily: fonts.medium },

    body: { flex: 1 },
    bodyContent: { padding: spacing.lg, gap: spacing.md },

    progressCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    progressIcon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
    progressLabel: { flex: 1, fontSize: 14.5, fontFamily: fonts.extrabold, letterSpacing: -0.1 },
    progressStep: { fontSize: 14, fontFamily: fonts.mono, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
    progressNote: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.inkMuted },

    detailsCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: 6,
      ...shadow.card,
    },
    detailsLabel: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    detailsValue: { fontSize: 14.5, fontFamily: fonts.semibold, color: colors.ink },
    detailsLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    detailsSub: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkMuted },

    footer: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.hairline },
  });
}
