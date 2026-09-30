import { computeOpenSlots, DEFAULT_WEEK, SLOT_HOURS } from '../slots';

// 2030-01-07 is a Monday. Accra is UTC+0 all year, so availability times
// map straight onto UTC.
const MON = Date.UTC(2030, 0, 7);
const at = (h: number, dayOffset = 0) => new Date(MON + dayOffset * 86_400_000 + h * 3_600_000).toISOString();
const NOW = new Date(MON - 86_400_000); // Sunday: everything Monday is in the future

describe('computeOpenSlots', () => {
  const weekly = [{ day_of_week: 1, start_time: '08:00:00', end_time: '14:00:00' }];

  it('cuts an availability window into back-to-back slots', () => {
    const slots = computeOpenSlots({ mode: 'SCHEDULE', weekly, exceptions: [], busy: [], from: new Date(MON), days: 1, now: NOW });
    expect(slots).toEqual([at(8), at(10), at(12)]);
  });

  it('drops slots that overlap an existing job', () => {
    const slots = computeOpenSlots({
      mode: 'SCHEDULE', weekly, exceptions: [], busy: [at(9)], from: new Date(MON), days: 1, now: NOW,
    });
    // A job 09:00-11:00 blocks the 08:00 (ends 10:00) and 10:00 slots.
    expect(slots).toEqual([at(12)]);
  });

  it('drops slots earlier than the minimum lead time', () => {
    const now = new Date(MON + 8 * 3_600_000 + 30 * 60_000); // 08:30
    const slots = computeOpenSlots({ mode: 'SCHEDULE', weekly, exceptions: [], busy: [], from: new Date(MON), days: 1, now });
    // Lead time is 1h, so 09:30 is the earliest start: 08:00 is out, 10:00 and 12:00 stay.
    expect(slots).toEqual([at(10), at(12)]);
  });

  it('offers nothing when the provider is unavailable or paused', () => {
    for (const mode of ['UNAVAILABLE', 'PAUSED'] as const) {
      expect(computeOpenSlots({ mode, weekly, exceptions: [], busy: [], from: new Date(MON), days: 7, now: NOW })).toEqual([]);
    }
  });

  it('falls back to the default working week when none is set', () => {
    expect(DEFAULT_WEEK.length).toBe(5);
    const slots = computeOpenSlots({ mode: 'SCHEDULE', weekly: [], exceptions: [], busy: [], from: new Date(MON), days: 1, now: NOW });
    expect(slots[0]).toBe(at(8));
    expect(slots.length).toBe((18 - 8) / SLOT_HOURS);
  });

  it('honours a day-off exception', () => {
    const slots = computeOpenSlots({
      mode: 'SCHEDULE', weekly, exceptions: [{ date: '2030-01-07', available: false, start_time: null, end_time: null }],
      busy: [], from: new Date(MON), days: 1, now: NOW,
    });
    expect(slots).toEqual([]);
  });

  it('uses an extra-hours exception in place of the weekly window', () => {
    const slots = computeOpenSlots({
      mode: 'SCHEDULE', weekly, exceptions: [{ date: '2030-01-07', available: true, start_time: '16:00:00', end_time: '20:00:00' }],
      busy: [], from: new Date(MON), days: 1, now: NOW,
    });
    expect(slots).toEqual([at(16), at(18)]);
  });

  it('skips days the provider does not work', () => {
    const slots = computeOpenSlots({ mode: 'SCHEDULE', weekly, exceptions: [], busy: [], from: new Date(MON), days: 3, now: NOW });
    expect(slots.every((s) => s.startsWith('2030-01-07'))).toBe(true);
  });
});
