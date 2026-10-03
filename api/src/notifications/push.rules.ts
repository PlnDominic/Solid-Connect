export type NotificationPrefKey = 'jobUpdates' | 'newQuotes' | 'messages' | 'promotions';

export function notificationPrefKey(type: string): NotificationPrefKey {
  const t = type.toUpperCase();
  if (t.includes('QUOTE')) return 'newQuotes';
  if (t.includes('MESSAGE') || t.startsWith('CHAT')) return 'messages';
  if (t.includes('BROADCAST') || t.includes('PROMO')) return 'promotions';
  return 'jobUpdates';
}

/** Missing key defaults to on, except promotions. */
export function pushEnabled(prefs: Record<string, unknown> | null | undefined, type: string): boolean {
  const key = notificationPrefKey(type);
  const raw = prefs?.[key];
  if (typeof raw === 'boolean') return raw;
  return key !== 'promotions';
}

export function isExpoPushToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

export function pushDeepLink(data: Record<string, unknown> | null | undefined): string {
  // A notification may name its own screen (disputes do, see 0054).
  const url = data?.url;
  if (typeof url === 'string' && url.startsWith('solidconnect://')) return url;
  const jobId = data?.jobId;
  if (typeof jobId === 'string' && jobId.length > 0) return `solidconnect://jobs/${jobId}`;
  return 'solidconnect://notifications';
}

export function isDeadPushToken(error: string | null | undefined): boolean {
  return error === 'DeviceNotRegistered';
}

export type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

export function ticketOutcome(ticket: ExpoTicket | undefined): { ok: boolean; ticketId: string | null; error: string | null } {
  if (ticket?.status === 'ok' && ticket.id) {
    return { ok: true, ticketId: ticket.id, error: null };
  }
  return {
    ok: false,
    ticketId: null,
    error: ticket?.details?.error || ticket?.message || 'PUSH_REJECTED',
  };
}
