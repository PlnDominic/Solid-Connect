import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthFlowScreen } from '../screens/onboarding/AuthFlowScreen';
import { useSessionStore } from '../store/useSessionStore';
import { CustomerTabs } from './CustomerTabs';
import { ProviderTabs } from './ProviderTabs';

const Stack = createNativeStackNavigator();

function MainTabs() {
  const role = useSessionStore((s) => s.profile?.role);
  return role === 'provider' ? <ProviderTabs /> : <CustomerTabs />;
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Auth">
        {({ navigation }) => <AuthFlowScreen onDone={() => navigation.replace('Main')} />}
      </Stack.Screen>
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}
