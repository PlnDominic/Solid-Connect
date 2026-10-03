import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fetchProfile } from '../api/profile';
import { LocationGate } from '../components/LocationGate';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useSyncAuthEmail } from '../hooks/useSyncAuthEmail';
import { getCurrentUserId } from '../lib/auth';
import { markLandingSeen } from '../lib/landing';
import { isSupabaseConfigured } from '../lib/supabase';
import { AuthFlowScreen } from '../screens/onboarding/AuthFlowScreen';
import { useSessionStore } from '../store/useSessionStore';
import { useTheme } from '../theme/ThemeProvider';
import { CustomerTabs } from './CustomerTabs';
import { ProviderTabs } from './ProviderTabs';

const Stack = createNativeStackNavigator();

function MainTabs() {
  const role = useSessionStore((s) => s.profile?.role);
  return <LocationGate>{role === 'provider' ? <ProviderTabs /> : <CustomerTabs />}</LocationGate>;
}

/**
 * Resolves the cold-start session before the stack mounts so a signed-in
 * user opens on Main and never flashes the marketing landing.
 */
export function RootNavigator() {
  useSyncAuthEmail();
  usePushRegistration();
  const { colors } = useTheme();
  const setProfile = useSessionStore((s) => s.setProfile);
  const setBootstrapping = useSessionStore((s) => s.setBootstrapping);
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'Auth' | 'Main'>('Auth');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured) {
        setBootstrapping(false);
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const userId = await getCurrentUserId();
        if (userId) {
          await markLandingSeen();
          const profile = await fetchProfile(userId);
          if (profile && !cancelled) {
            setProfile(profile);
            setInitialRoute('Main');
          }
        }
      } catch {
        // AuthFlowScreen surfaces a friendly error if Auth is shown.
      } finally {
        setBootstrapping(false);
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Auth">
        {({ navigation }) => <AuthFlowScreen onDone={() => navigation.replace('Main')} />}
      </Stack.Screen>
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}
