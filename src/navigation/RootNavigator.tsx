import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useQueryClient } from '@tanstack/react-query';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fetchProfile } from '../api/profile';
import { LocationGate } from '../components/LocationGate';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useSyncAuthEmail } from '../hooks/useSyncAuthEmail';
import { getCurrentUserId, isEmailConfirmationUrl, isPasswordResetUrl, onSessionEnded } from '../lib/auth';
import { stashPendingReferralCode } from '../api/referrals';
import { firstMissingSignUpStep, profileSignUpDetails } from '../lib/signUpSteps';
import { isSupabaseConfigured } from '../lib/supabase';
import { AuthFlowScreen } from '../screens/onboarding/AuthFlowScreen';
import { useSessionStore } from '../store/useSessionStore';
import { useTheme } from '../theme/ThemeProvider';
import { CustomerTabs } from './CustomerTabs';
import { ProviderTabs } from './ProviderTabs';
import { takeCustomerAction, type AccountTab, type CustomerAction } from './customerAccess';

type RootRoutes = {
  Auth: { action?: CustomerAction; incomingUrl?: string; returnTab?: AccountTab } | undefined;
  Main: { screen: 'HomeTab'; params: CustomerAction & { initial: false } } | { screen: AccountTab } | undefined;
};

const Stack = createNativeStackNavigator<RootRoutes>();

async function rememberReferral(url: string) {
  const { path, hostname, queryParams } = Linking.parse(url);
  const code = queryParams?.code;
  if ((path === 'referral' || hostname === 'referral') && typeof code === 'string' && /^[a-z0-9]+$/i.test(code)) {
    await stashPendingReferralCode(code.toUpperCase()).catch(() => {});
  }
}

function MainTabs({ navigation }: { navigation: { isFocused: () => boolean; navigate: (screen: 'Auth', params: RootRoutes['Auth']) => void } }) {
  const role = useSessionStore((s) => s.profile?.role);
  const queryClient = useQueryClient();
  useEffect(
    () =>
      onSessionEnded(() => {
        const { profile, setProfile, setUserId } = useSessionStore.getState();
        if (!profile) return;
        queryClient.clear();
        setProfile(null);
        setUserId(null);
        navigation.navigate('Auth', undefined);
        Alert.alert('You have been signed out', 'Sign in again to continue.');
      }),
    [navigation, queryClient],
  );
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!navigation.isFocused()) return;
      if (isPasswordResetUrl(url) || (!role && isEmailConfirmationUrl(url))) {
        navigation.navigate('Auth', { incomingUrl: url });
      } else if (!role) {
        void rememberReferral(url);
      }
    });
    return () => subscription.remove();
  }, [navigation, role]);
  if (!role) return <CustomerTabs />;
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
  const [initialRoute, setInitialRoute] = useState<'Auth' | 'Main'>('Main');
  const [initialAuthUrl, setInitialAuthUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured) {
        setBootstrapping(false);
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const initialUrl = await Linking.getInitialURL().catch(() => null);
        if (initialUrl && (isPasswordResetUrl(initialUrl) || isEmailConfirmationUrl(initialUrl))) {
          if (!cancelled) {
            setInitialAuthUrl(initialUrl);
            setInitialRoute('Auth');
          }
          return;
        }
        if (initialUrl) await rememberReferral(initialUrl);
        const userId = await getCurrentUserId();
        if (userId) {
          const profile = await fetchProfile(userId);
          // Only a fully onboarded account opens on Main - one missing a
          // required detail (e.g. made by a Google sign-in that skipped
          // steps) stays on Auth, which resumes at the first missing step.
          if (profile && !cancelled && firstMissingSignUpStep(profileSignUpDetails(profile)) === null) {
            setProfile(profile);
          } else if (!cancelled) {
            setInitialRoute('Auth');
          }
        }
      } catch {
        if (!cancelled) setInitialRoute('Auth');
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
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} accessibilityLabel="Opening Solid Connect" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Auth" initialParams={initialAuthUrl ? { incomingUrl: initialAuthUrl } : undefined}>
        {({ navigation, route }) => (
          <AuthFlowScreen
            action={route.params?.action}
            incomingUrl={route.params?.incomingUrl}
            onBrowse={() => {
              setInitialAuthUrl(undefined);
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.replace('Main');
            }}
            onDone={async () => {
              setInitialAuthUrl(undefined);
              const profile = useSessionStore.getState().profile;
              const returnTab = route.params?.returnTab;
              const savedAction = returnTab ? undefined : await takeCustomerAction(profile?.email).catch(() => undefined);
              const action = profile?.role === 'customer' ? route.params?.action ?? savedAction : undefined;
              navigation.reset({
                index: 0,
                routes: [{
                  name: 'Main',
                  params: action
                    ? { screen: 'HomeTab', params: { ...action, initial: false } }
                    : returnTab ? { screen: returnTab } : undefined,
                }],
              });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}
