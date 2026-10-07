import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export { friendlyAuthError } from './friendlyAuthError';

// Completes a pending browser-based OAuth session when the app is opened
// via the redirect deep link (required once, at module scope, for
// WebBrowser.openAuthSessionAsync to resolve on web).
WebBrowser.maybeCompleteAuthSession();

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Redirect back into the app after Google OAuth.
 * - Expo Go: must be exp://… (Expo Go cannot claim solidconnect://; Safari
 *   shows "address is invalid" if it lands on a custom scheme as a page).
 * - Dev/prod builds: solidconnect://auth/callback
 *
 * Supabase Site URL must stay an https:// URL (e.g. your project URL).
 * Put deep links only under Additional Redirect URLs.
 */
function getOAuthRedirectUrl(): string {
  if (isExpoGo) {
    return makeRedirectUri({
      path: 'auth/callback',
      preferLocalhost: false,
    });
  }
  return makeRedirectUri({
    scheme: 'solidconnect',
    path: 'auth/callback',
    native: 'solidconnect://auth/callback',
  });
}

/**
 * Current session's user id, if any - real accounts only. A lingering
 * anonymous session from before this app used real auth (or a stray one
 * from anywhere else) does not count as signed in, and gets cleared so it
 * can't cause a false "already logged in" skip on a later launch.
 *
 * Also the one enforcement point for admin-suspended accounts: checked
 * once here, at app-launch sign-in, not on every screen or mid-session -
 * a suspension takes effect on that person's next app launch, which is a
 * deliberate, scoped trade-off (see 0026_review_moderation_and_suspension.sql).
 * A suspended user is force-signed-out and this throws instead of
 * returning null, so AuthFlowScreen's existing error display shows them
 * the reason instead of silently dropping them at the splash screen.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  if (user.is_anonymous) {
    await supabase.auth.signOut();
    return null;
  }
  const { data: profile } = await supabase.from('profiles').select('suspended_at, suspended_reason').eq('id', user.id).maybeSingle();
  if (profile?.suspended_at) {
    await supabase.auth.signOut();
    throw new Error(
      profile.suspended_reason
        ? `Your account has been suspended: ${profile.suspended_reason}`
        : 'Your account has been suspended. Contact support if you think this is a mistake.',
    );
  }
  return user.id;
}

/**
 * Creates a real Supabase account (email + password). If the project has
 * "Confirm email" enabled, `data.session` comes back null until the user
 * clicks the confirmation link - callers should handle that case rather
 * than assume an active session.
 */
/** What the sign-up screens collected before the account existed. */
export type SignUpMetadata = { full_name?: string; phone?: string; area?: string };

/**
 * Creates the auth account. The sign-up details ride along as user
 * metadata so they survive email confirmation: the person often confirms
 * from their mail app and comes back to a fresh app launch, by which time
 * the screens' in-memory state is gone (see getSignUpMetadata).
 */
export async function signUpWithPassword(email: string, password: string, metadata: SignUpMetadata = {}) {
  // An explicit return address, so the confirmation link opens the app
  // rather than falling back to the project's Site URL (the admin site).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata, emailRedirectTo: getOAuthRedirectUrl() },
  });
  if (error) throw error;
  return data;
}

/** The details stored by signUpWithPassword (or the name an OAuth provider
 * gave), plus the account's email. */
export async function getSignUpMetadata(): Promise<SignUpMetadata & { email?: string }> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return {
    full_name: str(meta.full_name),
    phone: str(meta.phone),
    area: str(meta.area),
    email: str(user?.email),
  };
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

/** Where the link in the password-reset email sends someone back into the app. */
function getPasswordResetRedirectUrl(): string {
  if (isExpoGo) {
    return makeRedirectUri({ path: 'auth/reset-password', preferLocalhost: false });
  }
  return makeRedirectUri({
    scheme: 'solidconnect',
    path: 'auth/reset-password',
    native: 'solidconnect://auth/reset-password',
  });
}

/**
 * Emails a password reset. The email carries both a link back into the app
 * (handled by completePasswordResetFromUrl) and, when the Supabase "Reset
 * Password" template includes {{ .Token }}, a code for
 * verifyPasswordResetCode - the code works even when the email is opened on
 * another device. Supabase answers the same whether or not the address has
 * an account, so this never reveals who is signed up.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getPasswordResetRedirectUrl() });
  if (error) throw error;
}

/** Trades the code from the reset email for a session, so the password can be changed. */
export async function verifyPasswordResetCode(email: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (error) throw error;
  if (!data.user) throw new Error('That code did not open an account. Request a new one.');
  return data.user;
}

/** True for a URL opened from the reset-password email's link. */
export function isPasswordResetUrl(url: string | null | undefined): boolean {
  return !!url && /auth\/reset-password/.test(url);
}

/** Completes the reset email's link (a PKCE `code`, or tokens) into a session. */
export async function completePasswordResetFromUrl(url: string) {
  const data = await createSessionFromUrl(url);
  if (!data.user) throw new Error('This reset link has expired. Request a new one.');
  return data.user;
}

/** Sets a new password for the signed-in account (used after a reset). */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Google sign-in via Supabase's browser PKCE OAuth flow. Requires the
 * Google provider in the Supabase dashboard (Auth → Providers → Google)
 * and this app's redirect URL in Auth → URL Configuration.
 */
export async function signInWithGoogle() {
  const redirectTo = getOAuthRedirectUrl();
  if (__DEV__) {
    // Exact value that must be allow-listed (or covered by exp://** /
    // solidconnect://**) in the Supabase dashboard.
    // eslint-disable-next-line no-console
    console.log('[auth] Google OAuth redirectTo =', redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in was cancelled.');
  }
  return createSessionFromUrl(result.url);
}

/**
 * Apple sign-in via the native Apple Authentication Services sheet, then
 * exchanged for a Supabase session. iOS only - requires the Apple provider
 * in the Supabase dashboard (Auth → Providers → Apple). The full name is
 * only returned on the first authorization, so we persist it immediately.
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
  await supabase.auth.getUser();

  if (credential.fullName) {
    const nameParts = [
      credential.fullName.givenName,
      credential.fullName.middleName,
      credential.fullName.familyName,
    ].filter((part): part is string => Boolean(part && part.trim()));
    if (nameParts.length > 0) {
      const fullName = nameParts.join(' ');
      const { data: updated, error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          given_name: credential.fullName.givenName ?? undefined,
          family_name: credential.fullName.familyName ?? undefined,
        },
      });
      if (!updateError && updated.user) {
        return { ...data, user: updated.user };
      }
    }
  }

  return data;
}

/** True on devices where the native Apple Sign In sheet can actually appear. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Completes an OAuth redirect. Prefers PKCE (`?code=…` → exchangeCodeForSession);
 * falls back to implicit tokens in the query/hash for older Supabase projects.
 */
async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const oauthError = params.error_description || params.error;
  if (oauthError) {
    throw new Error(decodeURIComponent(oauthError.replace(/\+/g, ' ')));
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    // Force the in-memory session to be readable before callers hit RPCs
    // that use auth.uid() (e.g. my_private_profile after Google sign-in).
    await supabase.auth.getUser();
    return data;
  }

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    await supabase.auth.getUser();
    return data;
  }

  throw new Error('The sign-in redirect did not include a session.');
}
