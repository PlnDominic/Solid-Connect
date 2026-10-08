/**
 * What the API needs to know about a profile row on every request: which
 * role they are acting as, and whether an admin has suspended them.
 * (The admin site records a suspension on profiles.suspended_at.)
 */
export function accessFromProfile(
  row:
    { role?: string | null; suspended_at?: string | null } | null | undefined,
): { activeRole: 'customer' | 'provider' | null; suspended: boolean } {
  const activeRole =
    row?.role === 'provider' || row?.role === 'customer' ? row.role : null;
  return { activeRole, suspended: Boolean(row?.suspended_at) };
}
