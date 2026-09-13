/**
 * Turns a raw error (often a native fetch/URLSession exception on a flaky
 * connection - e.g. "UnexpectedException: The network connection was lost.
 * (at ExpoModulesCore/Promise.swift:56)") into something worth putting in
 * front of a user. Genuine Supabase auth errors (wrong password, duplicate
 * email, etc.) already read fine and pass through unchanged.
 *
 * Supabase throws several different error shapes depending on which client
 * failed: AuthError is a real Error subclass, but PostgrestError/
 * StorageError (thrown by .from(...) database calls) are plain objects with
 * a `message` field and are NOT `instanceof Error` - checking only
 * `instanceof Error` silently swallowed those and always fell back to the
 * generic message. Read `.message` off anything that has one.
 *
 * Deliberately its own module, no Expo/React Native imports: auth.ts (where
 * this used to live) runs OAuth session setup as a module-level side
 * effect, which needs the full Expo runtime to even import - this function
 * has no such dependency and shouldn't be untestable by association.
 */
export function friendlyAuthError(e: unknown, fallback: string): string {
  let raw = '';
  if (typeof e === 'string') {
    raw = e;
  } else if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    raw = (e as { message: string }).message;
  }
  if (/network connection|network request failed|fetch failed|offline|internet connection|timed? ?out/i.test(raw)) {
    return "Couldn't reach Solid Connect. Check your connection and try again.";
  }
  return raw || fallback;
}
