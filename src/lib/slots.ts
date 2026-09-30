/**
 * Turns a provider's working hours into bookable appointment slots.
 *
 * Availability times are Africa/Accra, which is UTC+0 all year (no DST), so
 * they are applied directly as UTC - the result doesn't depend on the
 * phone's own timezone. Pure and dependency-free so it can be unit tested.
 */

export const SLOT_HOURS = 2;
/** Earliest a slot can start, measured from now. */
export const MIN_LEAD_HOURS = 1;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type WeeklyWindow = { day_of_week: number; start_time: string; end_time: string };
export type AvailabilityException = {
  date: string; // YYYY-MM-DD
  available: boolean;
  start_time: string | null;
  end_time: string | null;
};

/** Mon-Fri 08:00-18:00 - what a provider gets before setting their own hours
 * (same default as the provider's Availability screen). */
export const DEFAULT_WEEK: WeeklyWindow[] = [1, 2, 3, 4, 5].map((day_of_week) => ({
  day_of_week,
  start_time: '08:00:00',
  end_time: '18:00:00',
}));

/** "08:30:00" -> milliseconds since midnight. */
function timeToMs(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return ((h || 0) * 60 + (m || 0)) * 60_000;
}

/**
 * Open slot start times (ISO strings, ascending) for `days` days from `from`.
 * `busy` holds the start of each existing job; each blocks SLOT_HOURS.
 */
export function computeOpenSlots(input: {
  mode: 'AVAILABLE_NOW' | 'UNAVAILABLE' | 'SCHEDULE' | 'PAUSED' | null | undefined;
  weekly: WeeklyWindow[];
  exceptions: AvailabilityException[];
  busy: string[];
  from: Date;
  days: number;
  now?: Date;
}): string[] {
  if (input.mode === 'UNAVAILABLE' || input.mode === 'PAUSED') return [];

  const weekly = input.weekly.length ? input.weekly : DEFAULT_WEEK;
  const now = (input.now ?? new Date()).getTime();
  const earliest = now + MIN_LEAD_HOURS * HOUR_MS;
  const busy = input.busy.map((b) => new Date(b).getTime());
  const slotMs = SLOT_HOURS * HOUR_MS;

  const first = Date.UTC(input.from.getUTCFullYear(), input.from.getUTCMonth(), input.from.getUTCDate());
  const out: string[] = [];

  for (let i = 0; i < input.days; i++) {
    const dayStart = first + i * DAY_MS;
    const dayDate = new Date(dayStart);
    const dateKey = dayDate.toISOString().slice(0, 10);
    const exception = input.exceptions.find((e) => e.date === dateKey);

    let windows: { start: number; end: number }[];
    if (exception) {
      windows =
        exception.available && exception.start_time && exception.end_time
          ? [{ start: timeToMs(exception.start_time), end: timeToMs(exception.end_time) }]
          : [];
    } else {
      windows = weekly
        .filter((w) => w.day_of_week === dayDate.getUTCDay())
        .map((w) => ({ start: timeToMs(w.start_time), end: timeToMs(w.end_time) }));
    }

    for (const w of windows.sort((a, b) => a.start - b.start)) {
      for (let s = dayStart + w.start; s + slotMs <= dayStart + w.end; s += slotMs) {
        if (s < earliest) continue;
        if (busy.some((b) => s < b + slotMs && s + slotMs > b)) continue;
        out.push(new Date(s).toISOString());
      }
    }
  }
  return out;
}
