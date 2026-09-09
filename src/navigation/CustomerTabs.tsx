import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { NewRequestScreen } from '../screens/customer/NewRequestScreen';
import { MatchingScreen } from '../screens/customer/MatchingScreen';
import { AllProvidersScreen } from '../screens/customer/AllProvidersScreen';
import { ProviderDetailScreen } from '../screens/customer/ProviderDetailScreen';
import { RequestsScreen } from '../screens/customer/RequestsScreen';
import { JobsScreen } from '../screens/customer/JobsScreen';
import { JobDetailScreen } from '../screens/customer/JobDetailScreen';
import { RateJobScreen } from '../screens/customer/RateJobScreen';
import { ProfileScreen } from '../screens/customer/ProfileScreen';
import { SavedProvidersScreen } from '../screens/customer/SavedProvidersScreen';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { ChatThreadScreen } from '../screens/shared/ChatThreadScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { PaymentMethodsScreen } from '../screens/shared/PaymentMethodsScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { HelpSupportScreen } from '../screens/shared/HelpSupportScreen';
import { AppearanceScreen } from '../screens/shared/AppearanceScreen';
import { AccountSecurityScreen } from '../screens/shared/AccountSecurityScreen';
import { ReferralScreen } from '../screens/shared/ReferralScreen';
import { LegalScreen } from '../screens/shared/LegalScreen';
import { DisputeScreen } from '../screens/shared/DisputeScreen';
import { TabBar } from './TabBar';

const HomeStackNav = createNativeStackNavigator();
function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="Home" component={HomeScreen} />
      <HomeStackNav.Screen name="NewRequest" component={NewRequestScreen} />
      <HomeStackNav.Screen name="Matching" component={MatchingScreen} />
      <HomeStackNav.Screen name="AllProviders" component={AllProvidersScreen} />
      <HomeStackNav.Screen name="ProviderDetail" component={ProviderDetailScreen} />
    </HomeStackNav.Navigator>
  );
}

const RequestsStackNav = createNativeStackNavigator();
function RequestsStack() {
  return (
    <RequestsStackNav.Navigator screenOptions={{ headerShown: false }}>
      <RequestsStackNav.Screen name="RequestsHome" component={RequestsScreen} />
    </RequestsStackNav.Navigator>
  );
}

const JobsStackNav = createNativeStackNavigator();
function JobsStack() {
  return (
    <JobsStackNav.Navigator screenOptions={{ headerShown: false }}>
      <JobsStackNav.Screen name="JobsHome" component={JobsScreen} />
      <JobsStackNav.Screen name="JobDetail" component={JobDetailScreen} />
      <JobsStackNav.Screen name="RateJob" component={RateJobScreen} />
      <JobsStackNav.Screen name="Dispute" component={DisputeScreen} />
    </JobsStackNav.Navigator>
  );
}

const ChatStackNav = createNativeStackNavigator();
function ChatStack() {
  return (
    <ChatStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ChatStackNav.Screen name="ChatList">
        {(props) => <ChatListScreen {...props} role="customer" />}
      </ChatStackNav.Screen>
      <ChatStackNav.Screen name="ChatThread" component={ChatThreadScreen} />
    </ChatStackNav.Navigator>
  );
}

const ProfileStackNav = createNativeStackNavigator();
function ProfileStack() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStackNav.Screen name="SavedProviders" component={SavedProvidersScreen} />
      <ProfileStackNav.Screen name="ProviderDetail" component={ProviderDetailScreen} />
      <ProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStackNav.Screen name="AccountSecurity" component={AccountSecurityScreen} />
      <ProfileStackNav.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <ProfileStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStackNav.Screen name="Appearance" component={AppearanceScreen} />
      <ProfileStackNav.Screen name="Referral" component={ReferralScreen} />
      <ProfileStackNav.Screen name="Legal" component={LegalScreen} />
      <ProfileStackNav.Screen name="HelpSupport" component={HelpSupportScreen} />
    </ProfileStackNav.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function CustomerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="RequestsTab" component={RequestsStack} options={{ tabBarLabel: 'Requests' }} />
      <Tab.Screen name="JobsTab" component={JobsStack} options={{ tabBarLabel: 'Jobs' }} />
      <Tab.Screen name="ChatTab" component={ChatStack} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
