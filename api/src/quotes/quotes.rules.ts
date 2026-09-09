/** Pure quote acceptance guards for unit tests. */
export function canAcceptQuote(input: {
  quoteStatus: string;
  requestStatus: string;
  requestCustomerId: string;
  actorId: string;
}) {
  if (input.requestCustomerId !== input.actorId) return { ok: false as const, code: 'NOT_REQUEST_OWNER' };
  if (input.quoteStatus !== 'sent') return { ok: false as const, code: 'QUOTE_NOT_OPEN' };
  if (!['open', 'matching', 'quoted'].includes(input.requestStatus)) {
    return { ok: false as const, code: 'REQUEST_NOT_ACCEPTABLE' };
  }
  return { ok: true as const };
}

export function canReviseQuote(input: { quoteStatus: string; providerId: string; actorId: string }) {
  if (input.providerId !== input.actorId) return { ok: false as const, code: 'NOT_QUOTE_OWNER' };
  if (input.quoteStatus !== 'sent') return { ok: false as const, code: 'QUOTE_LOCKED' };
  return { ok: true as const };
}
