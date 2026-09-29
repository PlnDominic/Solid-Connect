import { googleCalendarUrl, planReminders, reminderId } from '../jobReminders';

const HOUR = 3_600_000;
const START = '2030-01-07T10:00:00.000Z';
const startMs = new Date(START).getTime();

describe('planReminders', () => {
  it('plans a 24h and a 1h reminder for a far-off appointment', () => {
    const plan = planReminders(START, new Date(startMs - 48 * HOUR));
    expect(plan.map((p) => p.key)).toEqual(['24h', '1h']);
    expect(plan[0].fireAt.getTime()).toBe(startMs - 24 * HOUR);
    expect(plan[1].fireAt.getTime()).toBe(startMs - HOUR);
  });

  it('skips reminders whose time has already passed', () => {
    const plan = planReminders(START, new Date(startMs - 5 * HOUR));
    expect(plan.map((p) => p.key)).toEqual(['1h']);
  });

  it('plans nothing once the appointment is under an hour away', () => {
    expect(planReminders(START, new Date(startMs - 30 * 60_000))).toEqual([]);
  });

  it('plans nothing for a missing or invalid time', () => {
    expect(planReminders(null)).toEqual([]);
    expect(planReminders('not a date')).toEqual([]);
  });
});

describe('reminderId', () => {
  it('changes when the appointment moves, so a reschedule replaces old reminders', () => {
    expect(reminderId('job1', '1h', START)).not.toBe(reminderId('job1', '1h', '2030-01-08T10:00:00.000Z'));
    expect(reminderId('job1', '1h', START)).toMatch(/^job-reminder:job1:1h:/);
  });
});

describe('googleCalendarUrl', () => {
  it('builds a prefilled 2-hour event', () => {
    const url = googleCalendarUrl({ title: 'Fix sink', startIso: START, location: 'Osu, Accra', details: 'With Kwame' });
    expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(url).toContain('text=Fix%20sink');
    expect(url).toContain('dates=20300107T100000Z%2F20300107T120000Z');
    expect(url).toContain('location=Osu%2C%20Accra');
    expect(url).toContain('details=With%20Kwame');
  });
});
