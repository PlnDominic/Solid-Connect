import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// Completes a pending browser-based OAuth session when the app is opened
// via the redirect deep link (required once, at module scope, for
// WebBrowser.openAuthSessionAsync to resolve on some platforms).
WebBrowser.maybeCompleteAuthSession();

const OAUTH_REDIRECT_URL = Linking.createURL('auth/callback');

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

/**
 * Current session's user id, if any - real accounts only. A lingering
 * anonymous session from before this app used real auth (or a stray one
 * from anywhere else) does not count as signed in, and gets cleared so it
 * can't cause a false "already logged in" skip on a later launch.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  if (user.is_anonymous) {
    await supabase.auth.signOut();
    return null;
  }
  return user.id;
}

/**
 * Creates a real Supabase account (email + password). If the project has
 * "Confirm email" enabled, `data.session` comes back null until the user
 * clicks the confirmation link - callers should handle that case rather
 * than assume an active session.
 */
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** Sign in with an existing account by email or phone, plus password. */
export async function signInWithPassword(
  identifier: string,
  password: string,
  method: 'email' | 'phone'
) {
  const { data, error } = await supabase.auth.signInWithPassword(
    method === 'email' ? { email: identifier, password } : { phone: identifier, password }
  );
  if (error) throw error;
  return data;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Google sign-in via Supabase's browser-based OAuth flow. Requires the
 * Google provider to be configured in the Supabase dashboard (Auth →
 * Providers → Google, with a Google Cloud OAuth client id/secret) - this
 * call is real, but throws a Supabase error until that's set up.
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT_URL);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in was cancelled.');
  }
  return setSessionFromRedirectUrl(result.url);
}

/**
 * Apple sign-in via the native Apple Authentication Services sheet, then
 * exchanged for a Supabase session. iOS only - requires the Apple provider
 * to be configured in the Supabase dashboard (Auth → Providers → Apple).
 */
export async function signInWithApple() {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple sign-in is only available on iOS.');
  }
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token.');
  }
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  return data;
}

/** True on devices where the native Apple Sign In sheet can actually appear. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

// Supabase's implicit OAuth flow returns tokens in the URL fragment
// (#access_token=...&refresh_token=...), not the query string.
function setSessionFromRedirectUrl(redirectUrl: string) {
  const fragment = redirectUrl.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) {
    throw new Error('The sign-in redirect did not include a session.');
  }
  return supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
}
