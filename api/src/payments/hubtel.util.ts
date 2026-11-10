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
