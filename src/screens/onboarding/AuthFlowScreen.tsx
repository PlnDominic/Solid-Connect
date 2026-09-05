import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createOrUpdateOwnProfile, fetchProfile, savePushSubscription } from '../../api/profile';
import {
  friendlyAuthError,
  getCurrentUserId,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '../../lib/auth';
import { registerForPushNotificationsAsync } from '../../lib/pushNotifications';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts } from '../../theme';
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
 * session. A device with an already-active Supabase session (a genuine
 * prior login) skips straight past splash/onboarding/auth; everyone else
 * gets splash -> onboarding -> the login page, with "Create an account"
 * leading into name -> phone -> location -> email -> role -> password.
 * Choosing "provider" adds one more stop first - which trade - since that
 * drives the marketplace's category filter; customers skip straight from
 * role to password. Role (and trade) are chosen before the account exists,
 * so they're just held in state until the password step actually creates
 * the account and the profile row together.
 */
export function AuthFlowScreen({ onDone }: { onDone: () => void }) {
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
  const [providerCategory, setProviderCategory] = useState('');
  const [roleChoiceLoading, setRoleChoiceLoading] = useState<Role | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const setProfile = useSessionStore((s) => s.setProfile);
  const setBootstrapping = useSessionStore((s) => s.setBootstrapping);

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
          const profile = await fetchProfile(userId);
          if (profile) {
            setProfile(profile);
            setBootstrapping(false);
            onDone();
            return;
          }
        }
        setBootstrapping(false);
        setPhase('splash');
      } catch (e: any) {
        setError(friendlyAuthError(e, 'Something went wrong connecting to Solid Connect.'));
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const profile = await createOrUpdateOwnProfile(userId, role, { fullName, phone, email, area });
        setProfile(profile);
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
          providerCategory,
        });
        setProfile(profile);
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
      const result = await signUpWithPassword(email, password);
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
        providerCategory,
      });
      setProfile(profile);
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
      onDone();
      return;
    }
    // Authenticated but never finished the role step (e.g. confirmed email
    // in a different session, or a first-time Google/Apple sign-in).
    setPhase('signup-role');
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
      const meta = result.user.user_metadata;
      if (meta?.full_name) setFullName(String(meta.full_name));
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
    return <OnboardingScreen onDone={() => setPhase('signin')} />;
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
      />
    );
  }

  if (phase === 'signup-category') {
    return (
      <SignUpCategoryScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={8}
        value={providerCategory}
        onChangeValue={setProviderCategory}
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

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.white },
  errorWrap: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center' },
});
