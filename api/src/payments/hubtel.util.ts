/** Ghana MSISDN → Hubtel Send Money channel. */
export function momoChannel(phone: string): 'mtn-gh' | 'vodafone-gh' | 'tigo-gh' | null {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('233') ? `0${digits.slice(3)}` : digits;
  const prefix = local.slice(0, 3);
  if (['024', '025', '053', '054', '055', '059'].includes(prefix)) return 'mtn-gh';
  if (['020', '050'].includes(prefix)) return 'vodafone-gh';
  if (['027', '057', '026', '056'].includes(prefix)) return 'tigo-gh';
  return null;
}

/** Hubtel expects 233XXXXXXXXX. */
export function toMsisdn(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
  return null;
}

export function isHubtelPaid(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return s === 'paid' || s === 'success' || s === 'successful' || s === 'completed';
}

export function clientReferenceFromCallback(body: Record<string, unknown> | null | undefined): string | null {
  if (!body) return null;
  const data = (body.Data ?? body.data) as Record<string, unknown> | undefined;
  const raw =
    data?.ClientReference ??
    data?.clientReference ??
    body.ClientReference ??
    body.clientReference;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}
