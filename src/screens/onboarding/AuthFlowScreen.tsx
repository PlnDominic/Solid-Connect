import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createOrUpdateOwnProfile, fetchProfile } from '../../api/profile';
import { ensureAnonymousSession } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts } from '../../theme';
import type { Role } from '../../types/database';
import { LoginScreen } from './LoginScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { SplashScreen } from './SplashScreen';

type Phase = 'bootstrapping' | 'splash' | 'onboarding' | 'login' | 'error';

/**
 * Orchestrates the cold-start flow: splash always plays, then either drops
 * straight into the app (returning device with a profile already) or walks
 * through onboarding + the customer/provider pick (first run).
 */
export function AuthFlowScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('bootstrapping');
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<Role | null>(null);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const setUserId = useSessionStore((s) => s.setUserId);
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
        const userId = await ensureAnonymousSession();
        setUserId(userId);
        const profile = await fetchProfile(userId);
        if (profile) {
          setProfile(profile);
          setHasExistingProfile(true);
        }
        setBootstrapping(false);
        setPhase('splash');
      } catch (e: any) {
        setError(e?.message ?? 'Something went wrong connecting to Solid Connect.');
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelectRole(role: Role) {
    const userId = useSessionStore.getState().userId;
    if (!userId) return;
    setSelecting(role);
    try {
      const profile = await createOrUpdateOwnProfile(userId, role);
      setProfile(profile);
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'Could not sign you in. Please try again.');
      setSelecting(null);
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
    return (
      <SplashScreen
        onFinish={() => {
          if (hasExistingProfile) onDone();
          else setPhase('onboarding');
        }}
      />
    );
  }

  if (phase === 'onboarding') {
    return <OnboardingScreen onDone={() => setPhase('login')} />;
  }

  return <LoginScreen onSelectRole={handleSelectRole} loading={selecting} />;
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.white },
  errorWrap: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center' },
});
