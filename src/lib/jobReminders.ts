import { getNotifications } from './runtime';
import { SLOT_HOURS } from './slots';
import type { Job } from '../types/database';

const HOUR_MS = 3_600_000;
const PREFIX = 'job-reminder:';

const OFFSETS = [
  { key: '24h', ms: 24 * HOUR_MS },
  { key: '1h', ms: HOUR_MS },
] as const;

export type PlannedReminder = { key: (typeof OFFSETS)[number]['key']; fireAt: Date };

/** Which reminders still lie in the future for an appointment. */
export function planReminders(scheduledFor: string | null | undefined, now: Date = new Date()): PlannedReminder[] {
  if (!scheduledFor) return [];
  const start = new Date(scheduledFor).getTime();
  if (Number.isNaN(start)) return [];
  return OFFSETS.map((o) => ({ key: o.key, fireAt: new Date(start - o.ms) })).filter((r) => r.fireAt.getTime() > now.getTime());
}

/** Includes the appointment time, so moving the job yields new ids and the
 * old reminders are recognised as stale and cancelled. */
export function reminderId(jobId: string, key: string, scheduledFor: string): string {
  return `${PREFIX}${jobId}:${key}:${new Date(scheduledFor).getTime()}`;
}

/** A prefilled Google Calendar "new event" link. Opens in the Calendar app
 * or the browser, so it needs no native module (expo-calendar does not run
 * in Expo Go). */
export function googleCalendarUrl(e: { title: string; startIso: string; location?: string; details?: string }): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(e.startIso);
  const end = new Date(start.getTime() + SLOT_HOURS * HOUR_MS);
  const q = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(e.title)}`,
    `dates=${encodeURIComponent(`${fmt(start)}/${fmt(end)}`)}`,
    e.location ? `location=${encodeURIComponent(e.location)}` : '',
    e.details ? `details=${encodeURIComponent(e.details)}` : '',
  ].filter(Boolean);
  return `https://calendar.google.com/calendar/render?${q.join('&')}`;
}

/**
 * Makes the phone's scheduled reminders match `jobs`: schedules the missing
 * ones for accepted jobs with a future appointment, and cancels any of ours
 * that no longer apply (job moved, started, cancelled). Local notifications,
 * so no server is involved. Silently does nothing where notifications aren't
 * available (Expo Go on Android, web) or permission wasn't granted.
 */
export async function syncJobReminders(jobs: Job[]): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;

    const wanted = new Map<string, { job: Job; r: PlannedReminder }>();
    for (const job of jobs) {
      if (job.status !== 'accepted' || !job.scheduled_for) continue;
      for (const r of planReminders(job.scheduled_for)) wanted.set(reminderId(job.id, r.key, job.scheduled_for), { job, r });
    }

    const existing = (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier).filter((id) => id.startsWith(PREFIX));

    for (const id of existing) {
      if (!wanted.has(id)) await Notifications.cancelScheduledNotificationAsync(id);
    }
    for (const [id, { job, r }] of wanted) {
      if (existing.includes(id)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: r.key === '24h' ? 'Job tomorrow' : 'Job in 1 hour',
          body: `${job.title} · ${job.location_label}`,
          data: { jobId: job.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: 'default' },
      });
    }
  } catch {
    // Reminders are a convenience; never let them break the app.
  }
}
