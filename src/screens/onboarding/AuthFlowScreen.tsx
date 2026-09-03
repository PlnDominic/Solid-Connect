import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createOrUpdateOwnProfile, fetchProfile } from '../../api/profile';
import {
  friendlyAuthError,
  getCurrentUserId,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts } from '../../theme';
import type { Role } from '../../types/database';
import { OnboardingScreen } from './OnboardingScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpConfirmEmailScreen } from './SignUpConfirmEmailScreen';
import { SignUpEmailScreen } from './SignUpEmailScreen';
import { SignUpNameScreen } from './SignUpNameScreen';
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
  | 'signup-email'
  | 'signup-password'
  | 'signup-confirm-email'
  | 'signup-role'
  | 'signin'
  | 'error';

// 3 onboarding info slides + name + phone + email + role + password.
const TOTAL_STEPS = 8;

/**
 * Orchestrates the cold-start flow. Real accounts only - no anonymous
 * session. A device with an already-active Supabase session (a genuine
 * prior login) skips straight past splash/onboarding/auth; everyone else
 * gets splash -> onboarding -> the login page, with "Create an account"
 * leading into name -> phone -> email -> role -> password. Role is chosen
 * before the account exists, so it's just held in state until the password
 * step actually creates the account and the profile row together.
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
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleChoiceLoading, setRoleChoiceLoading] = useState<Role | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
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
    // The role step is also reached already-authenticated (a first-time
    // Google/Apple sign-in, or someone back after confirming their email) -
    // finish the profile directly rather than sending them through another
    // password step for an account they already have.
    setRoleChoiceLoading(role);
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const profile = await createOrUpdateOwnProfile(userId, role, { fullName, phone, email });
        setProfile(profile);
        onDone();
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
      const profile = await createOrUpdateOwnProfile(result.user.id, selectedRole, { fullName, phone, email });
      setProfile(profile);
      onDone();
    } catch (e: any) {
      setPasswordError(friendlyAuthError(e, 'Could not create your account. Please try again.'));
    } finally {
      setPasswordLoading(false);
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
        onNext={() => setPhase('signup-email')}
      />
    );
  }

  if (phase === 'signup-email') {
    return (
      <SignUpEmailScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={5}
        value={email}
        onChangeValue={setEmail}
        onBack={() => setPhase('signup-phone')}
        onNext={() => setPhase('signup-role')}
      />
    );
  }

  if (phase === 'signup-role') {
    return (
      <SignUpScreen
        firstName={fullName.trim().split(/\s+/)[0] || 'there'}
        totalSteps={TOTAL_STEPS}
        activeIndex={6}
        onBack={() => setPhase('signup-email')}
        onSelectRole={handleChooseRole}
        loading={roleChoiceLoading}
        errorMessage={roleError}
      />
    );
  }

  if (phase === 'signup-password') {
    return (
      <SignUpPasswordScreen
        totalSteps={TOTAL_STEPS}
        activeIndex={7}
        onBack={() => setPhase('signup-role')}
        onSubmit={handlePasswordSubmit}
        loading={passwordLoading}
        errorMessage={passwordError}
      />
    );
  }

  if (phase === 'signup-confirm-email') {
    return <SignUpConfirmEmailScreen email={email} onGoToSignIn={() => setPhase('signin')} />;
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
