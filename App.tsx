import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { RootNavigator } from './src/navigation/RootNavigator';
import { linking } from './src/navigation/linking';
import { BiometricLockGate } from './src/components/BiometricLockGate';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { UpdateRequiredGate } from './src/components/UpdateRequiredGate';
import { installGlobalErrorReporting, setCurrentScreen } from './src/lib/errorReporting';
import { JobReminderSync } from './src/components/JobReminderSync';
import { OfflineBanner } from './src/components/OfflineBanner';
import { LocaleProvider } from './src/i18n';
import { ThemeProvider } from './src/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

installGlobalErrorReporting();

/** Name of the deepest focused route, so a report says which screen it came from. */
function activeRouteName(state: any): string | null {
  let node = state;
  let name: string | null = null;
  while (node?.routes) {
    const route = node.routes[node.index ?? 0];
    name = route?.name ?? name;
    node = route?.state;
  }
  return name;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // If a font fails to load, open with the phone's own font rather than never.
  const canRender = fontsLoaded || !!fontError;

  useEffect(() => {
    if (canRender) SplashScreen.hideAsync().catch(() => {});
  }, [canRender]);

  if (!canRender) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ThemeProvider>
            <ErrorBoundary>
              <UpdateRequiredGate>
                <BiometricLockGate>
                  <NavigationContainer linking={linking} onStateChange={(state) => setCurrentScreen(activeRouteName(state))}>
                    <RootNavigator />
                  </NavigationContainer>
                  <JobReminderSync />
                </BiometricLockGate>
              </UpdateRequiredGate>
              {/* Outside the gate: it also reloads data when the app comes back. */}
              <OfflineBanner />
            </ErrorBoundary>
          </ThemeProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
