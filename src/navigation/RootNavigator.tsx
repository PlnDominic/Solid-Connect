import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { useSyncAuthEmail } from '../hooks/useSyncAuthEmail';
import { LocationGate } from '../components/LocationGate';
import { AuthFlowScreen } from '../screens/onboarding/AuthFlowScreen';
import { useSessionStore } from '../store/useSessionStore';
import { CustomerTabs } from './CustomerTabs';
import { ProviderTabs } from './ProviderTabs';

const Stack = createNativeStackNavigator();

function MainTabs() {
  const role = useSessionStore((s) => s.profile?.role);
  return <LocationGate>{role === 'provider' ? <ProviderTabs /> : <CustomerTabs />}</LocationGate>;
}

export function RootNavigator() {
  useSyncAuthEmail();
  usePushRegistration();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Auth">
        {({ navigation }) => <AuthFlowScreen onDone={() => navigation.replace('Main')} />}
      </Stack.Screen>
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}
