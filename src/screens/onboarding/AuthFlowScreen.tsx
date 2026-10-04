import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { createOrUpdateOwnProfile, fetchProfile, savePushSubscription } from '../../api/profile';
import { useCategories } from '../../api/marketplace';
import { claimReferral, popPendingReferralCode, stashPendingReferralCode } from '../../api/referrals';
import {
  friendlyAuthError,
  getCurrentUserId,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  getSignUpMetadata,
  signUpWithPassword,
} from '../../lib/auth';
import { hasSeenLanding, markLandingSeen } from '../../lib/landing';
import { LEGAL_VERSION } from '../../lib/legal';
import { registerForPushNotificationsAsync } from '../../lib/pushNotifications';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Role } from '../../types/database';
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
  | 'error';

// 3 onboarding info slides + name + phone + location + email + role +
// category (providers only) + password.
const TOTAL_STEPS = 10;

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
  const setProfile = useSessionStore((s) => s.setProfile);
  const setBootstrapping = useSessionStore((s) => s.setBootstrapping);

  // Grab an invite code off the opening URL (cold start) and any link
  // tapped while the flow is already on screen (warm start), and stash it
  // in storage too so an app kill mid-sign-up (e.g. after confirming
  // email) doesn't lose the friend's credit.
  useEffect(() => {
    function rememberCode(url: string | null) {
      const code = url?.match(/[?&]code=([A-Za-z0-9]+)/)?.[1];
      if (!code) return;
      const upper = code.toUpperCase();
      setReferralCode(upper);
      stashPendingReferralCode(upper).catch(() => {});
    }
    Linking.getInitialURL()
      .then(rememberCode)
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => rememberCode(url));
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
        const userId = await getCurrentUserId();
        if (userId) {
          // Signed-in users never see the marketing landing.
          await markLandingSeen();
          const profile = await fetchProfile(userId);
          if (profile) {
            setProfile(profile);
            setBootstrapping(false);
            onDone();
            return;
          }
          // Session exists but the profile is unfinished - continue signup,
          // do not send them through splash/landing again.
          setBootstrapping(false);
          await resumeUnfinishedSignUp();
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

  async function afterSignIn(userId: string) {
    const profile = await fetchProfile(userId);
    if (profile) {
      setProfile(profile);
      await claimReferralAfterAuth();
      onDone();
      return;
    }
    // Authenticated but never finished the role step (e.g. confirmed email
    // in a different session, or a first-time Google/Apple sign-in).
    await resumeUnfinishedSignUp();
  }

  /**
   * Picks sign-up back up for an account with no profile yet. What was typed
   * before the account existed may only survive as auth metadata (an app
   * restart while confirming email wipes this screen's state), so restore
   * it from there; without a name, ask for the details again rather than
   * create a nameless profile.
   */
  async function resumeUnfinishedSignUp() {
    let name = fullName.trim();
    try {
      const meta = await getSignUpMetadata();
      name = name || meta.full_name || '';
      if (meta.full_name && !fullName.trim()) setFullName(meta.full_name);
      if (meta.phone && !phone.trim()) setPhone(meta.phone);
      if (meta.area && !area.trim()) setArea(meta.area);
      if (meta.email && !email.trim()) setEmail(meta.email);
    } catch {
      // Fall through to asking for the details.
    }
    setPhase(name ? 'signup-role' : 'signup-name');
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

  async function handleGoogle() {
    setSignInLoading('google');
    setSignInErr(null);
    try {
      const result = await signInWithGoogle();
      if (!result.user) throw new Error('Google sign-in did not return an account.');
      if (result.user.user_metadata?.full_name) setFullName(String(result.user.user_metadata.full_name));
      if (result.user.email) setEmail(result.user.email);
      await afterSignIn(result.user.id);
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
      if (appleName) setFullName(String(appleName));
      if (result.user.email) setEmail(result.user.email);
      await afterSignIn(result.user.id);
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

  if (phase === 'signup-notifications') {
    return (
      <SignUpNotificationsScreen onEnable={handleEnableNotifications} onSkip={handleSkipNotifications} loading={notifLoading} />
    );
  }

  return (
    <SignInScreen
      onSubmit={handleSignInPassword}
      onGoToSignUp={() => setPhase('signup-name')}
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
