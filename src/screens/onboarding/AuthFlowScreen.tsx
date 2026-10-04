import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { createOrUpdateOwnProfile, fetchProfile, savePushSubscription } from '../../api/profile';
import { useCategories } from '../../api/marketplace';
import { claimReferral, popPendingReferralCode, stashPendingReferralCode } from '../../api/referrals';
import {
  completePasswordResetFromUrl,
  friendlyAuthError,
  getCurrentUserId,
  isPasswordResetUrl,
  signOut,
  updatePassword,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  getSignUpMetadata,
  signUpWithPassword,
} from '../../lib/auth';
import { hasSeenLanding, markLandingSeen } from '../../lib/landing';
import { LEGAL_VERSION } from '../../lib/legal';
import { registerForPushNotificationsAsync } from '../../lib/pushNotifications';
import { firstMissingSignUpStep, profileSignUpDetails, type SignUpStep } from '../../lib/signUpSteps';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Profile, Role } from '../../types/database';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpCategoryScreen } from './SignUpCategoryScreen';
import { SignUpConfirmEmailScreen } from './SignUpConfirmEmailScreen';
import { SignUpEmailScreen } from './SignUpEmailScreen';
import { SignUpLocationScreen } from './SignUpLocationScreen';
import { SignUpNameScreen } from './SignUpNameScreen';
import { SignUpNotificationsScreen } from './SignUpNotificationsScreen';
import { SignUpPasswordScreen } from './SignUpPasswordScreen';
import { SignUpPhoneScreen } from './SignUpPhoneScreen';
import { SignUpScreen } from './SignUpScreen';
import { SplashScreen } from './SplashScreen';

type Phase =
  | 'bootstrapping'
  | 'splash'
  | 'onboarding'
  | 'signup-name'
  | 'signup-phone'
  | 'signup-location'
  | 'signup-email'
  | 'signup-password'
  | 'signup-confirm-email'
  | 'signup-role'
  | 'signup-category'
  | 'signup-notifications'
  | 'signin'
  | 'forgot-password'
  | 'reset-password'
  | 'error';

// 3 onboarding info slides + name + phone + location + email + role +
// category (providers only) + password.
const TOTAL_STEPS = 10;

type SignInHints = { fullName?: string; email?: string };

const PHASE_FOR_STEP: Record<SignUpStep, Phase> = {
  name: 'signup-name',
  phone: 'signup-phone',
  location: 'signup-location',
  email: 'signup-email',
  role: 'signup-role',
  category: 'signup-category',
};

/**
 * Orchestrates the cold-start flow. Real accounts only - no anonymous
 * session.
 *
 * - Signed-in with a profile → Main (never the marketing landing).
 * - Returning / signed-out device → splash is skipped; login/signup only.
 * - First install → splash → landing (location + Get started / Sign in).
 *
 * "Create an account" then runs name → phone → area → email → role →
 * password (providers pick a trade before password).
 */
export function AuthFlowScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: categories = [] } = useCategories();
  const [phase, setPhase] = useState<Phase>('bootstrapping');
  const [error, setError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [signInLoading, setSignInLoading] = useState<'password' | 'google' | 'apple' | null>(null);
  const [signInErr, setSignInErr] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [providerCategoryIds, setProviderCategoryIds] = useState<string[]>([]);
  const [roleChoiceLoading, setRoleChoiceLoading] = useState<Role | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  // Invite code carried from a "solidconnect://referral?code=..." link
  // (or typed on sign-in) until an account exists to claim it with -
  // see claimReferralAfterAuth below.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  // Set once an account exists (social sign-in, or resuming), so the
  // phone/email duplicate checks don't flag this user's own details.
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const setProfile = useSessionStore((s) => s.setProfile);
  const setBootstrapping = useSessionStore((s) => s.setBootstrapping);

  // Grab an invite code off the opening URL (cold start) and any link
  // tapped while the flow is already on screen (warm start), and stash it
  // in storage too so an app kill mid-sign-up (e.g. after confirming
  // email) doesn't lose the friend's credit.
  useEffect(() => {
    function rememberCode(url: string | null) {
      // A reset-password link carries an auth `code`, not an invite code.
      if (isPasswordResetUrl(url)) return;
      const code = url?.match(/[?&]code=([A-Za-z0-9]+)/)?.[1];
      if (!code) return;
      const upper = code.toUpperCase();
      setReferralCode(upper);
      stashPendingReferralCode(upper).catch(() => {});
    }
    Linking.getInitialURL()
      .then(rememberCode)
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isPasswordResetUrl(url)) void openPasswordResetLink(url);
      else rememberCode(url);
    });
    return () => sub.remove();
  }, []);

  /**
   * Claims the held invite code once an account exists. Best-effort: a
   * failure (window closed, bad code, already referred) must never block
   * sign-in - the friend's credit is just missed this time.
   */
  async function claimReferralAfterAuth() {
    const code = referralCode ?? (await popPendingReferralCode());
    if (!code) return;
    setReferralCode(null);
    try {
      await claimReferral(code);
    } catch {
      // Deliberately swallowed - see docstring.
    }
  }

  // Only recorded when the checkbox on the role step was actually ticked -
  // omitted (not falsely dated) otherwise, so createOrUpdateOwnProfile's
  // own "don't overwrite an existing acceptance with nothing" guard has
  // something meaningful to skip.
  function termsMeta() {
    return termsAccepted ? { termsAcceptedAt: new Date().toISOString(), termsVersion: LEGAL_VERSION } : {};
  }

  function providerDetails() {
    const names = categories
      .filter((c) => providerCategoryIds.includes(c.id))
      .map((c) => c.name);
    return {
      providerCategory: names.join(' · ') || undefined,
      providerCategoryIds: providerCategoryIds.length ? providerCategoryIds : undefined,
    };
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError(
        "Supabase isn't configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file at the project root, then fully stop and restart with `npx expo start -c` (a reload alone won't pick up a new .env)."
      );
      setPhase('error');
      return;
    }
    (async () => {
      try {
        // Opened from the reset-password email: finish that before anything
        // else, or the session it creates would skip straight into the app
        // without the new password ever being set.
        const initialUrl = await Linking.getInitialURL().catch(() => null);
        if (initialUrl && isPasswordResetUrl(initialUrl)) {
          setBootstrapping(false);
          await openPasswordResetLink(initialUrl);
          return;
        }
        const userId = await getCurrentUserId();
        if (userId) {
          // Signed-in users never see the marketing landing.
          await markLandingSeen();
          setAuthUserId(userId);
          const profile = await fetchProfile(userId);
          setBootstrapping(false);
          // Finished accounts go to Main; anything unfinished continues
          // sign-up rather than going through splash/landing again.
          await finishOrResume(profile);
          return;
        }
        setBootstrapping(false);
        const seenLanding = await hasSeenLanding();
        setPhase(seenLanding ? 'signin' : 'splash');
      } catch (e: any) {
        setError(friendlyAuthError(e, 'Something went wrong connecting to Solid Connect.'));
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finishLanding(next: 'signin' | 'signup-name') {
    await markLandingSeen();
    setPhase(next);
  }

  async function handleChooseRole(role: Role) {
    setSelectedRole(role);
    setRoleError(null);
    if (role === 'provider') {
      // One more stop first - which trade - before finishing the profile
      // either way (already-authenticated or still headed to password).
      setPhase('signup-category');
      return;
    }
    // The role step is also reached already-authenticated (a first-time
    // Google/Apple sign-in, or someone back after confirming their email) -
    // finish the profile directly rather than sending them through another
    // password step for an account they already have.
    setRoleChoiceLoading(role);
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const profile = await createOrUpdateOwnProfile(userId, role, { fullName, phone, email, area, ...termsMeta() });
        setProfile(profile);
        await claimReferralAfterAuth();
        setPhase('signup-notifications');
        return;
      }
      setPhase('signup-password');
    } catch (e: any) {
      setRoleError(friendlyAuthError(e, 'Could not continue. Please try again.'));
    } finally {
      setRoleChoiceLoading(null);
    }
  }

  async function handleCategoryNext() {
    setRoleError(null);
    setRoleChoiceLoading('provider');
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const profile = await createOrUpdateOwnProfile(userId, 'provider', {
          fullName,
          phone,
          email,
          area,
          ...providerDetails(),
          ...termsMeta(),
        });
        setProfile(profile);
        await claimReferralAfterAuth();
        setPhase('signup-notifications');
        return;
      }
      setPhase('signup-password');
    } catch (e: any) {
      setRoleError(friendlyAuthError(e, 'Could not continue. Please try again.'));
    } finally {
      setRoleChoiceLoading(null);
    }
  }

  async function handlePasswordSubmit(password: string) {
    if (!selectedRole) {
      // Shouldn't happen (role is chosen before this step), but don't let
      // it silently create a role-less profile.
      setPhase('signup-role');
      return;
    }
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      const result = await signUpWithPassword(email, password, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        area: area.trim(),
      });
      if (!result.session || !result.user) {
        // "Confirm email" is on in this Supabase project - the account
        // exists but has no session yet.
        setPhase('signup-confirm-email');
        return;
      }
      const profile = await createOrUpdateOwnProfile(result.user.id, selectedRole, {
        fullName,
        phone,
        email,
        area,
        ...(selectedRole === 'provider' ? providerDetails() : {}),
        ...termsMeta(),
      });
      setProfile(profile);
      await claimReferralAfterAuth();
      setPhase('signup-notifications');
    } catch (e: any) {
      setPasswordError(friendlyAuthError(e, 'Could not create your account. Please try again.'));
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleEnableNotifications() {
    setNotifLoading(true);
    try {
      const { status, token } = await registerForPushNotificationsAsync();
      const userId = await getCurrentUserId();
      if (userId) await savePushSubscription(userId, status, token);
    } catch {
      // Best-effort - the account is already created, so a failure here
      // shouldn't block finishing sign-up.
    } finally {
      setNotifLoading(false);
      onDone();
    }
  }

  async function handleSkipNotifications() {
    setNotifLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (userId) await savePushSubscription(userId, 'skipped', null);
    } catch {
      // Same - don't block on it.
    } finally {
      setNotifLoading(false);
      onDone();
    }
  }

  /** `hints` carries what a social provider just told us (name, email) -
   * passed through directly because state set a moment ago isn't readable
   * until the next render. */
  async function afterSignIn(userId: string, hints: SignInHints = {}) {
    setAuthUserId(userId);
    const profile = await fetchProfile(userId);
    await finishOrResume(profile, hints);
  }

  /**
   * Every account must end with the same required details, however it
   * signed in. A complete profile goes to Main; otherwise sign-up picks up
   * at the first missing step and walks forward through every later step
   * (prefilled) - a Google/Apple sign-in hands us a name and email, but
   * never a phone, area, role, terms acceptance or trade.
   */
  async function finishOrResume(profile: Profile | null, hints: SignInHints = {}) {
    if (profile && firstMissingSignUpStep(profileSignUpDetails(profile)) === null) {
      setProfile(profile);
      await claimReferralAfterAuth();
      onDone();
      return;
    }
    await resumeUnfinishedSignUp(profile, hints);
  }

  /**
   * Picks sign-up back up for an account with no profile (or an incomplete
   * one). What was typed before the account existed may only survive as
   * auth metadata (an app restart while confirming email wipes this
   * screen's state), so restore it from there, then from any partial
   * profile row, and start at the first required step still missing.
   * Later steps still follow in order, prefilled, so nothing is skipped.
   */
  async function resumeUnfinishedSignUp(profile: Profile | null = null, hints: SignInHints = {}) {
    const known = {
      fullName: fullName.trim() || hints.fullName?.trim() || '',
      phone: phone.trim(),
      area: area.trim(),
      email: email.trim() || hints.email?.trim() || '',
    };
    try {
      const meta = await getSignUpMetadata();
      known.fullName ||= meta.full_name ?? '';
      known.phone ||= meta.phone ?? '';
      known.area ||= meta.area ?? '';
      known.email ||= meta.email ?? '';
    } catch {
      // Fall through to asking for the details.
    }
    if (profile) {
      known.fullName ||= profile.full_name ?? '';
      known.phone ||= profile.phone ?? '';
      known.area ||= profile.area ?? '';
      known.email ||= profile.email ?? '';
      if (profile.terms_accepted_at) setTermsAccepted(true);
    }
    setFullName(known.fullName);
    setPhone(known.phone);
    setArea(known.area);
    setEmail(known.email);
    // Role and terms are always confirmed on screen for a resumed account,
    // so the earliest this can start is the role step.
    const step = firstMissingSignUpStep({ ...known, role: null }) ?? 'role';
    setPhase(PHASE_FOR_STEP[step]);
  }

  async function handleSignInPassword(identifier: string, password: string, method: 'email' | 'phone') {
    setSignInLoading('password');
    setSignInErr(null);
    try {
      const result = await signInWithPassword(identifier, password, method);
      if (!result.user) throw new Error('Sign-in did not return an account.');
      await afterSignIn(result.user.id);
    } catch (e: any) {
      setSignInErr(friendlyAuthError(e, 'Could not sign you in. Check your details and try again.'));
    } finally {
      setSignInLoading(null);
    }
  }

  /** The reset email's link: it signs the person in, then they set a new password. */
  async function openPasswordResetLink(url: string) {
    setSignInErr(null);
    try {
      await completePasswordResetFromUrl(url);
      setPasswordError(null);
      setPhase('reset-password');
    } catch (e: any) {
      setSignInErr(friendlyAuthError(e, 'This reset link has expired. Request a new one.'));
      setPhase('signin');
    }
  }

  async function handleResetPassword(password: string) {
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      await updatePassword(password);
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Your reset session ended. Request a new reset email.');
      await afterSignIn(userId);
    } catch (e: any) {
      setPasswordError(friendlyAuthError(e, 'Could not update your password. Please try again.'));
    } finally {
      setPasswordLoading(false);
    }
  }

  /** Leaving the new-password step drops the reset session - it was only for that. */
  async function cancelPasswordReset() {
    await signOut().catch(() => {});
    setPhase('signin');
  }

  async function handleGoogle() {
    setSignInLoading('google');
    setSignInErr(null);
    try {
      const result = await signInWithGoogle();
      if (!result.user) throw new Error('Google sign-in did not return an account.');
      const googleName = result.user.user_metadata?.full_name;
      await afterSignIn(result.user.id, {
        fullName: googleName ? String(googleName) : undefined,
        email: result.user.email ?? undefined,
      });
    } catch (e: any) {
      setSignInErr(friendlyAuthError(e, 'Could not sign in with Google.'));
    } finally {
      setSignInLoading(null);
    }
  }

  async function handleApple() {
    setSignInLoading('apple');
    setSignInErr(null);
    try {
      const result = await signInWithApple();
      if (!result.user) throw new Error('Apple sign-in did not return an account.');
      const meta = result.user.user_metadata ?? {};
      const appleName =
        meta.full_name ||
        [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim();
      await afterSignIn(result.user.id, {
        fullName: appleName ? String(appleName) : undefined,
        email: result.user.email ?? undefined,
      });
    } catch (e: any) {
      setSignInErr(friendlyAuthError(e, 'Could not sign in with Apple.'));
    } finally {
      setSignInLoading(null);
    }
  }

  if (phase === 'bootstrapping') return <View style={styles.blank} />;

  if (phase === 'error') {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (phase === 'splash') {
    return <SplashScreen onFinish={() => setPhase('onboarding')} />;
  }

  if (phase === 'onboarding') {
    return (
      <OnboardingScreen
        onGetStarted={() => void finishLanding('signup-name')}
        onSignIn={() => void finishLanding('signin')}
      />
    );
  }

  if (phase === 'signup-name') {
    return (
      <SignUpNameScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={3}
        value={fullName}
        onChangeValue={setFullName}
        onBack={() => setPhase('signin')}
        onNext={() => setPhase('signup-phone')}
        onGoToSignIn={() => setPhase('signin')}
      />
    );
  }

  if (phase === 'signup-phone') {
    return (
      <SignUpPhoneScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={4}
        value={phone}
        onChangeValue={setPhone}
        excludeUserId={authUserId}
        onBack={() => setPhase('signup-name')}
        onNext={() => setPhase('signup-location')}
      />
    );
  }

  if (phase === 'signup-location') {
    return (
      <SignUpLocationScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={5}
        value={area}
        onChangeValue={setArea}
        onBack={() => setPhase('signup-phone')}
        onNext={() => setPhase('signup-email')}
      />
    );
  }

  if (phase === 'signup-email') {
    return (
      <SignUpEmailScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={6}
        value={email}
        onChangeValue={setEmail}
        excludeUserId={authUserId}
        onBack={() => setPhase('signup-location')}
        onNext={() => setPhase('signup-role')}
      />
    );
  }

  if (phase === 'signup-role') {
    return (
      <SignUpScreen
        firstName={fullName.trim().split(/\s+/)[0] || 'there'}
        totalSteps={TOTAL_STEPS}
        activeIndex={7}
        onBack={() => setPhase('signup-email')}
        onSelectRole={handleChooseRole}
        loading={roleChoiceLoading}
        errorMessage={roleError}
        termsAccepted={termsAccepted}
        onToggleTerms={() => setTermsAccepted((v) => !v)}
      />
    );
  }

  if (phase === 'signup-category') {
    return (
      <SignUpCategoryScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={8}
        values={providerCategoryIds}
        onChangeValues={setProviderCategoryIds}
        onBack={() => setPhase('signup-role')}
        onNext={handleCategoryNext}
        loading={roleChoiceLoading === 'provider'}
        errorMessage={roleError}
      />
    );
  }

  if (phase === 'signup-password') {
    return (
      <SignUpPasswordScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={9}
        onBack={() => setPhase(selectedRole === 'provider' ? 'signup-category' : 'signup-role')}
        onSubmit={handlePasswordSubmit}
        loading={passwordLoading}
        errorMessage={passwordError}
      />
    );
  }

  if (phase === 'signup-confirm-email') {
    return <SignUpConfirmEmailScreen email={email} onGoToSignIn={() => setPhase('signin')} />;
  }

  if (phase === 'forgot-password') {
    return (
      <ForgotPasswordScreen
        initialEmail={resetEmail}
        onBack={() => setPhase('signin')}
        onVerified={() => {
          setPasswordError(null);
          setPhase('reset-password');
        }}
      />
    );
  }

  if (phase === 'reset-password') {
    return (
      <SignUpPasswordScreen
        totalSteps={0}
        activeIndex={0}
        title="Set a new password"
        subtitle="Choose a new password for your account. You'll be signed in once it's saved."
        submitLabel="Save and sign in"
        onBack={() => void cancelPasswordReset()}
        onSubmit={handleResetPassword}
        loading={passwordLoading}
        errorMessage={passwordError}
      />
    );
  }

  if (phase === 'signup-notifications') {
    return (
      <SignUpNotificationsScreen onEnable={handleEnableNotifications} onSkip={handleSkipNotifications} loading={notifLoading} />
    );
  }

  return (
    <SignInScreen
      onSubmit={handleSignInPassword}
      onGoToSignUp={() => setPhase('signup-name')}
      onForgotPassword={(typedEmail) => {
        setSignInErr(null);
        setResetEmail(typedEmail ?? '');
        setPhase('forgot-password');
      }}
      onGoogle={handleGoogle}
      onApple={handleApple}
      loading={signInLoading}
      errorMessage={signInErr}
    />
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    blank: { flex: 1, backgroundColor: colors.paper },
    errorWrap: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 32 },
    errorText: { fontFamily: fonts.medium, fontSize: fontSizes.md, color: colors.ink, textAlign: 'center' },
  });
}
