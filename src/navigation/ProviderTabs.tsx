import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FeedScreen } from '../screens/provider/FeedScreen';
import { RequestDetailScreen } from '../screens/provider/RequestDetailScreen';
import { WorkScreen } from '../screens/provider/WorkScreen';
import { JobDetailScreen } from '../screens/provider/JobDetailScreen';
import { RateCustomerScreen } from '../screens/provider/RateCustomerScreen';
import { ProfileScreen } from '../screens/provider/ProfileScreen';
import { EarningsScreen } from '../screens/provider/EarningsScreen';
import { PayoutDetailsScreen } from '../screens/provider/PayoutDetailsScreen';
import { ServiceAreasScreen } from '../screens/provider/ServiceAreasScreen';
import { AvailabilityScreen } from '../screens/provider/AvailabilityScreen';
import { VerificationScreen } from '../screens/provider/VerificationScreen';
import { PortfolioScreen } from '../screens/provider/PortfolioScreen';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { ChatThreadScreen } from '../screens/shared/ChatThreadScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { HelpSupportScreen } from '../screens/shared/HelpSupportScreen';
import { AppearanceScreen } from '../screens/shared/AppearanceScreen';
import { LanguageScreen } from '../screens/shared/LanguageScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { AccountSecurityScreen } from '../screens/shared/AccountSecurityScreen';
import { ReferralScreen } from '../screens/shared/ReferralScreen';
import { BlockedUsersScreen } from '../screens/shared/BlockedUsersScreen';
import { LegalScreen } from '../screens/shared/LegalScreen';
import { DisputeScreen } from '../screens/shared/DisputeScreen';
import { ReceiptScreen } from '../screens/shared/ReceiptScreen';
import { OrganizationsScreen } from '../screens/shared/OrganizationsScreen';
import { OrganizationDetailScreen } from '../screens/shared/OrganizationDetailScreen';
import { MapScreen } from '../screens/shared/MapScreen';
import { PresenceSync } from '../components/PresenceSync';
import { TabBar } from './TabBar';

const FeedStackNav = createNativeStackNavigator();
function FeedStack() {
  return (
    <FeedStackNav.Navigator screenOptions={{ headerShown: false }}>
      <FeedStackNav.Screen name="Feed" component={FeedScreen} />
      <FeedStackNav.Screen name="RequestDetail" component={RequestDetailScreen} />
    </FeedStackNav.Navigator>
  );
}

const MapStackNav = createNativeStackNavigator();
function MapStack() {
  return (
    <MapStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MapStackNav.Screen name="MapHome">{(props) => <MapScreen {...props} role="provider" />}</MapStackNav.Screen>
    </MapStackNav.Navigator>
  );
}

// My Requests and Jobs as one "Work" tab. Same route name as the
// customer's Activity tab, so jobs/:jobId links resolve for either role.
const ActivityStackNav = createNativeStackNavigator();
function ActivityStack() {
  return (
    <ActivityStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ActivityStackNav.Screen name="ActivityHome" component={WorkScreen} />
      <ActivityStackNav.Screen name="JobDetail" component={JobDetailScreen} />
      <ActivityStackNav.Screen name="RateCustomer" component={RateCustomerScreen} />
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
        {(props) => <ChatListScreen {...props} role="provider" />}
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
      <ProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStackNav.Screen name="Organizations" component={OrganizationsScreen} />
      <ProfileStackNav.Screen name="OrganizationDetail" component={OrganizationDetailScreen} />
      <ProfileStackNav.Screen name="AccountSecurity" component={AccountSecurityScreen} />
      <ProfileStackNav.Screen name="Verification" component={VerificationScreen} />
      <ProfileStackNav.Screen name="Portfolio" component={PortfolioScreen} />
      <ProfileStackNav.Screen name="Earnings" component={EarningsScreen} />
      <ProfileStackNav.Screen name="PayoutDetails" component={PayoutDetailsScreen} />
      <ProfileStackNav.Screen name="ServiceAreas" component={ServiceAreasScreen} />
      <ProfileStackNav.Screen name="Availability" component={AvailabilityScreen} />
      <ProfileStackNav.Screen name="Appearance" component={AppearanceScreen} />
      <ProfileStackNav.Screen name="Language" component={LanguageScreen} />
      <ProfileStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStackNav.Screen name="Referral" component={ReferralScreen} />
      <ProfileStackNav.Screen name="Legal" component={LegalScreen} />
      <ProfileStackNav.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <ProfileStackNav.Screen name="HelpSupport" component={HelpSupportScreen} />
    </ProfileStackNav.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function ProviderTabs() {
  return (
    <>
      <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tab.Screen name="FeedTab" component={FeedStack} options={{ tabBarLabel: 'Feed' }} />
        <Tab.Screen name="MapTab" component={MapStack} options={{ tabBarLabel: 'Map' }} />
        <Tab.Screen name="ActivityTab" component={ActivityStack} options={{ tabBarLabel: 'Work' }} />
        <Tab.Screen name="ChatTab" component={ChatStack} options={{ tabBarLabel: 'Chat' }} />
        <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ tabBarLabel: 'Profile' }} />
      </Tab.Navigator>
      <PresenceSync />
    </>
  );
}
