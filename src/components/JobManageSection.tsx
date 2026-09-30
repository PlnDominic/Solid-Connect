import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { googleCalendarUrl } from '../lib/jobReminders';
import { CalendarClock } from 'lucide-react-native';
import {
  friendlyJobError,
  useCancelJob,
  useJobReschedules,
  useProposeReschedule,
  useRespondReschedule,
} from '../api/jobManagement';
import { fonts, radii, shadow, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import type { Job, JobCancelReason } from '../types/database';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

type Role = 'customer' | 'provider';

const NO_SHOW_GRACE_MS = 30 * 60 * 1000;

const CUSTOMER_REASONS: { key: JobCancelReason; label: string }[] = [
  { key: 'changed_mind', label: 'I no longer need this' },
  { key: 'no_show_provider', label: 'The provider did not show up' },
  { key: 'other', label: 'Something else' },
];
const PROVIDER_REASONS: { key: JobCancelReason; label: string }[] = [
  { key: 'provider_unavailable', label: 'I can no longer do this job' },
  { key: 'no_show_customer', label: 'The customer was not there' },
  { key: 'other', label: 'Something else' },
];

const REASON_LABEL: Record<string, string> = {
  changed_mind: 'Customer no longer needed the job',
  provider_unavailable: 'Provider was unavailable',
  no_show_provider: 'Provider did not show up',
  no_show_customer: 'Customer was not there',
  other: 'Cancelled',
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} at ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function nextDays(count: number) {
  const days: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(d);
  }
  return days;
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

/**
 * Everything about a job that isn't its progress: when it's scheduled, a
 * pending "can we move it?" proposal from the other person, and cancelling
 * (including a no-show report). Shown on both the customer and provider
 * job screens; the server (see 0044_job_cancel_reschedule.sql) enforces
 * every rule, this only decides what to offer.
 */
export function JobManageSection({ job, role, userId }: { job: Job; role: Role; userId: string }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: reschedules = [] } = useJobReschedules(job.id);
  const propose = useProposeReschedule();
  const respond = useRespondReschedule();
  const cancel = useCancelJob();

  const [showPicker, setShowPicker] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [hour, setHour] = useState<number | null>(null);
  const [reason, setReason] = useState<JobCancelReason | null>(null);
  const [note, setNote] = useState('');

  const days = useMemo(() => nextDays(14), []);
  const pending = reschedules.find((r) => r.status === 'pending');
  const canAnswer = pending && pending.proposed_by !== userId;

  if (job.status === 'cancelled') {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>CANCELLED</Text>
        <Text style={styles.value}>{REASON_LABEL[job.cancel_reason ?? 'other'] ?? 'Cancelled'}</Text>
        {job.cancel_note ? <Text style={styles.sub}>{job.cancel_note}</Text> : null}
        {job.cancelled_at ? <Text style={styles.sub}>{formatWhen(job.cancelled_at)}</Text> : null}
      </View>
    );
  }
  if (job.status !== 'accepted' && job.status !== 'in_progress') return null;

  const notStarted = job.status === 'accepted';
  const canCancel = notStarted || role === 'provider';
  const graceOver = Date.now() >= new Date(job.scheduled_for ?? job.started_at).getTime() + NO_SHOW_GRACE_MS;
  const reasons = (role === 'customer' ? CUSTOMER_REASONS : PROVIDER_REASONS).filter(
    (r) => !r.key.startsWith('no_show') || (notStarted && graceOver),
  );

  const chosenTime = (() => {
    if (hour === null) return null;
    const d = new Date(days[dayIndex]);
    d.setHours(hour, 0, 0, 0);
    return d;
  })();
  const chosenInPast = chosenTime ? chosenTime.getTime() < Date.now() + 15 * 60 * 1000 : false;

  async function submitProposal() {
    if (!chosenTime) return;
    try {
      await propose.mutateAsync({ jobId: job.id, proposedFor: chosenTime });
      setShowPicker(false);
      setHour(null);
    } catch (err) {
      Alert.alert('Could not propose that time', friendlyJobError(err));
    }
  }

  async function answer(accept: boolean) {
    if (!pending) return;
    try {
      await respond.mutateAsync({ jobId: job.id, rescheduleId: pending.id, accept });
    } catch (err) {
      Alert.alert('Could not answer', friendlyJobError(err));
    }
  }

  async function submitCancel() {
    if (!reason) return;
    try {
      await cancel.mutateAsync({ jobId: job.id, reason, note: note.trim() });
      setShowCancel(false);
    } catch (err) {
      Alert.alert('Could not cancel', friendlyJobError(err));
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <CalendarClock size={16} strokeWidth={2} color={colors.inkMuted} />
        <Text style={styles.label}>SCHEDULE</Text>
      </View>
      <Text style={styles.value}>{job.scheduled_for ? formatWhen(job.scheduled_for) : 'No time set yet'}</Text>
      {job.scheduled_for && notStarted ? (
        <Pressable
          onPress={() =>
            Linking.openURL(
              googleCalendarUrl({
                title: job.title,
                startIso: job.scheduled_for!,
                location: job.location_label,
                details: `Solid Connect job JOB-${job.id.slice(0, 8).toUpperCase()}`,
              }),
            ).catch(() => Alert.alert('Could not open your calendar', 'Try again in a moment.'))
          }
          accessibilityRole="button"
          accessibilityLabel="Add this appointment to your calendar"
          hitSlop={8}
        >
          <Text style={styles.calendarLink}>Add to calendar</Text>
        </Pressable>
      ) : null}

      {pending ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {canAnswer
              ? `The other person proposed ${formatWhen(pending.proposed_for)}.`
              : `Waiting for a reply to your proposal for ${formatWhen(pending.proposed_for)}.`}
          </Text>
          {canAnswer ? (
            <View style={styles.row}>
              <Button title="Decline" variant="outline" onPress={() => answer(false)} loading={respond.isPending} style={styles.half} />
              <Button title="Accept" onPress={() => answer(true)} loading={respond.isPending} style={styles.half} />
            </View>
          ) : null}
        </View>
      ) : null}

      {notStarted || canCancel ? (
        <View style={styles.row}>
          {notStarted ? (
            <Button
              title={job.scheduled_for ? 'Propose new time' : 'Set a time'}
              variant="outline"
              onPress={() => setShowPicker(true)}
              style={styles.half}
            />
          ) : null}
          {canCancel ? (
            <Button title="Cancel job" variant="outline" onPress={() => setShowCancel(true)} style={styles.half} />
          ) : null}
        </View>
      ) : (
        <Text style={styles.sub}>Work has started. If something is wrong, open a dispute.</Text>
      )}

      <BottomSheet visible={showPicker} onClose={() => setShowPicker(false)}>
        <Text style={styles.sheetTitle}>{job.scheduled_for ? 'Propose a new time' : 'Set a time'}</Text>
        <Text style={styles.sheetBody}>The other person has to accept before it changes.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {days.map((d, i) => (
            <Pressable
              key={d.toISOString()}
              onPress={() => setDayIndex(i)}
              style={[styles.chip, i === dayIndex && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: i === dayIndex }}
            >
              <Text style={[styles.chipText, i === dayIndex && styles.chipTextOn]}>
                {i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.hourGrid}>
          {HOURS.map((h) => {
            const slot = new Date(days[dayIndex]);
            slot.setHours(h, 0, 0, 0);
            const past = slot.getTime() < Date.now() + 15 * 60 * 1000;
            return (
              <Pressable
                key={h}
                disabled={past}
                onPress={() => setHour(h)}
                style={[styles.chip, hour === h && styles.chipOn, past && styles.chipOff]}
                accessibilityRole="button"
                accessibilityState={{ selected: hour === h, disabled: past }}
              >
                <Text style={[styles.chipText, hour === h && styles.chipTextOn]}>
                  {new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          title="Send proposal"
          onPress={submitProposal}
          disabled={!chosenTime || chosenInPast}
          loading={propose.isPending}
        />
      </BottomSheet>

      <BottomSheet visible={showCancel} onClose={() => setShowCancel(false)}>
        <Text style={styles.sheetTitle}>Cancel this job?</Text>
        <Text style={styles.sheetBody}>
          {role === 'customer'
            ? 'Your payment is refunded in full and the provider is told.'
            : 'The customer is refunded and told. Cancelling often can hurt your standing.'}
        </Text>
        {reasons.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => setReason(r.key)}
            style={[styles.reason, reason === r.key && styles.reasonOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === r.key }}
          >
            <Text style={[styles.reasonText, reason === r.key && styles.reasonTextOn]}>{r.label}</Text>
          </Pressable>
        ))}
        {notStarted && !graceOver ? (
          <Text style={styles.sub}>No-show reports open 30 minutes after the scheduled time.</Text>
        ) : null}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          maxLength={300}
          multiline
        />
        <View style={styles.row}>
          <Button title="Keep job" variant="outline" onPress={() => setShowCancel(false)} style={styles.half} />
          <Button title="Cancel job" onPress={submitCancel} disabled={!reason} loading={cancel.isPending} style={styles.half} />
        </View>
      </BottomSheet>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: { borderRadius: radii.lg, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.sm, ...shadow.card },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    label: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    value: { fontSize: 14.5, fontFamily: fonts.semibold, color: colors.ink },
    sub: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkMuted },
    calendarLink: { fontSize: 13, fontFamily: fonts.semibold, color: colors.active },
    banner: { borderRadius: radii.md, backgroundColor: colors.pendingBg, padding: spacing.md, gap: spacing.sm },
    bannerText: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink },
    row: { flexDirection: 'row', gap: 10 },
    half: { flex: 1, height: 46 },
    sheetTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
    sheetBody: { fontSize: 14, lineHeight: 22, fontFamily: fonts.regular, color: colors.inkMuted },
    chips: { gap: 8, paddingVertical: 4 },
    hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipOff: { opacity: 0.35 },
    chipText: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink },
    chipTextOn: { color: colors.white },
    reason: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline, padding: spacing.md },
    reasonOn: { borderColor: colors.ink, backgroundColor: colors.pendingBg },
    reasonText: { fontSize: 14, fontFamily: fonts.medium, color: colors.ink },
    reasonTextOn: { fontFamily: fonts.semibold },
    input: {
      minHeight: 56,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      padding: spacing.md,
      fontSize: 14,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
    },
  });
}
