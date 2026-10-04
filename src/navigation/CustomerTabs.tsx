import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { NewRequestScreen } from '../screens/customer/NewRequestScreen';
import { EditRequestScreen } from '../screens/customer/EditRequestScreen';
import { MatchingScreen } from '../screens/customer/MatchingScreen';
import { AllProvidersScreen } from '../screens/customer/AllProvidersScreen';
import { ProviderDetailScreen } from '../screens/customer/ProviderDetailScreen';
import { CompareQuotesScreen } from '../screens/customer/CompareQuotesScreen';
import { ActivityScreen } from '../screens/customer/ActivityScreen';
import { JobDetailScreen } from '../screens/customer/JobDetailScreen';
import { RateJobScreen } from '../screens/customer/RateJobScreen';
import { ProfileScreen } from '../screens/customer/ProfileScreen';
import { SavedProvidersScreen } from '../screens/customer/SavedProvidersScreen';
import { SavedLocationsScreen } from '../screens/shared/SavedLocationsScreen';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { ChatThreadScreen } from '../screens/shared/ChatThreadScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { PaymentMethodsScreen } from '../screens/shared/PaymentMethodsScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { HelpSupportScreen } from '../screens/shared/HelpSupportScreen';
import { AppearanceScreen } from '../screens/shared/AppearanceScreen';
import { LanguageScreen } from '../screens/shared/LanguageScreen';
import { AccountSecurityScreen } from '../screens/shared/AccountSecurityScreen';
import { ReferralScreen } from '../screens/shared/ReferralScreen';
import { BlockedUsersScreen } from '../screens/shared/BlockedUsersScreen';
import { LegalScreen } from '../screens/shared/LegalScreen';
import { DisputeScreen } from '../screens/shared/DisputeScreen';
import { ReceiptScreen } from '../screens/shared/ReceiptScreen';
import { OrganizationsScreen } from '../screens/shared/OrganizationsScreen';
import { OrganizationDetailScreen } from '../screens/shared/OrganizationDetailScreen';
import { MapScreen } from '../screens/shared/MapScreen';
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

const MapStackNav = createNativeStackNavigator();
function MapStack() {
  return (
    <MapStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MapStackNav.Screen name="MapHome">{(props) => <MapScreen {...props} role="customer" />}</MapStackNav.Screen>
    </MapStackNav.Navigator>
  );
}

// Requests and Jobs as one tab: a request becomes a job once a quote is
// accepted, so both live in the same stack.
const ActivityStackNav = createNativeStackNavigator();
function ActivityStack() {
  return (
    <ActivityStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ActivityStackNav.Screen name="ActivityHome" component={ActivityScreen} />
      <ActivityStackNav.Screen name="EditRequest" component={EditRequestScreen} />
      <ActivityStackNav.Screen name="CompareQuotes" component={CompareQuotesScreen} />
      <ActivityStackNav.Screen name="JobDetail" component={JobDetailScreen} />
      <ActivityStackNav.Screen name="RateJob" component={RateJobScreen} />
      <ActivityStackNav.Screen name="Dispute" component={DisputeScreen} />
      <ActivityStackNav.Screen name="Receipt" component={ReceiptScreen} />
    </ActivityStackNav.Navigator>
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
      <ProfileStackNav.Screen name="SavedLocations" component={SavedLocationsScreen} />
      <ProfileStackNav.Screen name="ProviderDetail" component={ProviderDetailScreen} />
      <ProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStackNav.Screen name="Organizations" component={OrganizationsScreen} />
      <ProfileStackNav.Screen name="OrganizationDetail" component={OrganizationDetailScreen} />
      <ProfileStackNav.Screen name="AccountSecurity" component={AccountSecurityScreen} />
      <ProfileStackNav.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <ProfileStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStackNav.Screen name="Appearance" component={AppearanceScreen} />
      <ProfileStackNav.Screen name="Language" component={LanguageScreen} />
      <ProfileStackNav.Screen name="Referral" component={ReferralScreen} />
      <ProfileStackNav.Screen name="Legal" component={LegalScreen} />
      <ProfileStackNav.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <ProfileStackNav.Screen name="HelpSupport" component={HelpSupportScreen} />
    </ProfileStackNav.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function CustomerTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="MapTab" component={MapStack} options={{ tabBarLabel: 'Map' }} />
      <Tab.Screen name="ActivityTab" component={ActivityStack} options={{ tabBarLabel: 'Activity' }} />
      <Tab.Screen name="ChatTab" component={ChatStack} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
