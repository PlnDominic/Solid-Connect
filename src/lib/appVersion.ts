/** True when `current` is a lower version than `minimum` ("1.9.0" < "1.10.0").
 * Anything missing or unreadable is false: never lock people out by mistake. */
export function isOlderVersion(current: string | null | undefined, minimum: string | null | undefined): boolean {
  const parse = (v: string | null | undefined) => (v && /^\d+(\.\d+){0,2}$/.test(v) ? v.split('.').map(Number) : null);
  const have = parse(current);
  const need = parse(minimum);
  if (!have || !need) return false;
  for (let i = 0; i < 3; i += 1) {
    const difference = (have[i] ?? 0) - (need[i] ?? 0);
    if (difference !== 0) return difference < 0;
  }
  return false;
}
