/**
 * True when an insert into `profiles` failed because this person's row is
 * already there (its primary key), as opposed to some other unique rule such
 * as the one-phone-number-per-account index (profiles_phone_key).
 *
 * Sign-up inserts the profile and, if it already exists (a repeated step, or
 * a social sign-in that came back), updates it instead. It can't be a single
 * upsert: Postgres needs read access to every column named in an
 * `ON CONFLICT DO UPDATE`, and phone and email are hidden from app users
 * (0073, 0076), so any upsert that names them is refused outright.
 */
export function isProfileAlreadyExists(
  error: { code?: string; message?: string; details?: string } | null | undefined,
): boolean {
  if (!error || error.code !== '23505') return false;
  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  return text.includes('profiles_pkey') || /Key \(id\)=/.test(text);
}
