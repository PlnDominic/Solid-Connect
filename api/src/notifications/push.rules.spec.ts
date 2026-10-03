import { isDeadPushToken, isExpoPushToken, notificationPrefKey, pushDeepLink, pushEnabled, ticketOutcome } from './push.rules';

describe('push rules', () => {
  it('maps notification types onto preference keys', () => {
    expect(notificationPrefKey('QUOTE_RECEIVED')).toBe('newQuotes');
    expect(notificationPrefKey('CHAT_MESSAGE')).toBe('messages');
    expect(notificationPrefKey('ADMIN_BROADCAST')).toBe('promotions');
    expect(notificationPrefKey('DISPUTE_OPENED')).toBe('jobUpdates');
  });

  it('leaves promotions off unless the user opted in', () => {
    expect(pushEnabled({}, 'PROMO')).toBe(false);
    expect(pushEnabled({ promotions: true }, 'PROMO')).toBe(true);
    expect(pushEnabled({ jobUpdates: false }, 'JOB_STARTED')).toBe(false);
    expect(pushEnabled(null, 'REVIEW_RECEIVED')).toBe(true);
  });

  it('accepts Expo push tokens and builds a job deep link', () => {
    expect(isExpoPushToken('ExponentPushToken[abc]')).toBe(true);
    expect(isExpoPushToken('not-a-token')).toBe(false);
    expect(pushDeepLink({ jobId: 'job-1' })).toBe('solidconnect://jobs/job-1');
    expect(pushDeepLink({})).toBe('solidconnect://notifications');
    expect(pushDeepLink({ jobId: 'job-1', url: 'solidconnect://jobs/job-1/dispute' })).toBe('solidconnect://jobs/job-1/dispute');
    expect(pushDeepLink({ jobId: 'job-1', url: 'https://evil.example' })).toBe('solidconnect://jobs/job-1');
  });

  it('treats a missing ticket and a dead device as failures', () => {
    expect(ticketOutcome({ status: 'ok', id: 't1' }).ok).toBe(true);
    expect(ticketOutcome({ status: 'error', details: { error: 'DeviceNotRegistered' } }).error).toBe('DeviceNotRegistered');
    expect(isDeadPushToken('DeviceNotRegistered')).toBe(true);
  });
});
