import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ClipboardList, MessageCircle, UserRound } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { HomeScreen } from '../screens/customer/HomeScreen';
import { NewRequestScreen } from '../screens/customer/NewRequestScreen';
import { PostJobScreen } from '../screens/customer/PostJobScreen';
import { MyJobPostsScreen } from '../screens/customer/MyJobPostsScreen';
import { JobPostDetailScreen } from '../screens/customer/JobPostDetailScreen';
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
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { HelpSupportScreen } from '../screens/shared/HelpSupportScreen';
import { AppearanceScreen } from '../screens/shared/AppearanceScreen';
import { AccountSecurityScreen } from '../screens/shared/AccountSecurityScreen';
import { ReferralScreen } from '../screens/shared/ReferralScreen';
import { BlockedUsersScreen } from '../screens/shared/BlockedUsersScreen';
import { LegalScreen } from '../screens/shared/LegalScreen';
import { DisputeScreen } from '../screens/shared/DisputeScreen';
import { OrganizationsScreen } from '../screens/shared/OrganizationsScreen';
import { OrganizationDetailScreen } from '../screens/shared/OrganizationDetailScreen';
import { MapScreen } from '../screens/shared/MapScreen';
import { AppTabs, type TabSpec } from './AppTabs';
import { useSessionStore } from '../store/useSessionStore';
import { useTabBarClearance } from './TabBar';
import type { AccountTab } from './customerAccess';

const guestAccountCopy = {
  ActivityTab: {
    title: 'Activity', heading: 'Keep track of your jobs',
    subtitle: 'See your requests, job posts, quotes and bookings here.', icon: ClipboardList,
  },
  ChatTab: {
    title: 'Chats', heading: 'Your conversations',
    subtitle: 'Sign in to message providers and read your conversations.', icon: MessageCircle,
  },
  ProfileTab: {
    title: 'Profile', heading: 'Your account',
    subtitle: 'Sign in to manage your account and saved providers.', icon: UserRound,
  },
};

function GuestAccountScreen({ navigation, tab }: {
  navigation: { navigate: (screen: string, params: { returnTab: AccountTab }) => void };
  tab: AccountTab;
}) {
  const tabClearance = useTabBarClearance();
  const copy = guestAccountCopy[tab];
  return (
    <Screen>
      <ScreenHeader title={copy.title} large />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: tabClearance }}>
        <EmptyState
          icon={copy.icon}
          title={copy.heading}
          subtitle={copy.subtitle}
          action={{ label: 'Sign in', onPress: () => navigation.navigate('Auth', { returnTab: tab }) }}
        />
      </ScrollView>
    </Screen>
  );
}

const HomeStackNav = createNativeStackNavigator();
function HomeStack() {
  const profile = useSessionStore((state) => state.profile);
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="Home" component={HomeScreen} />
      <HomeStackNav.Screen name="AllProviders" component={AllProvidersScreen} />
      <HomeStackNav.Screen name="ProviderDetail" component={ProviderDetailScreen} />
      {profile ? (
        <>
          <HomeStackNav.Screen name="NewRequest" component={NewRequestScreen} />
          <HomeStackNav.Screen name="Matching" component={MatchingScreen} />
          <HomeStackNav.Screen name="PostJob" component={PostJobScreen} />
          <HomeStackNav.Screen name="MyJobPosts" component={MyJobPostsScreen} />
          <HomeStackNav.Screen name="JobPostDetail" component={JobPostDetailScreen} />
          <HomeStackNav.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : null}
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
  const signedIn = useSessionStore((state) => !!state.profile);
  return (
    <ActivityStackNav.Navigator screenOptions={{ headerShown: false }}>
      {signedIn ? (
        <ActivityStackNav.Group navigationKey="account">
          <ActivityStackNav.Screen name="ActivityHome" component={ActivityScreen} />
          <ActivityStackNav.Screen name="EditRequest" component={EditRequestScreen} />
          <ActivityStackNav.Screen name="CompareQuotes" component={CompareQuotesScreen} />
          <ActivityStackNav.Screen name="JobDetail" component={JobDetailScreen} />
          <ActivityStackNav.Screen name="RateJob" component={RateJobScreen} />
          <ActivityStackNav.Screen name="Dispute" component={DisputeScreen} />
          <ActivityStackNav.Screen name="HelpSupport" component={HelpSupportScreen} />
        </ActivityStackNav.Group>
      ) : (
        <ActivityStackNav.Screen name="ActivityHome" navigationKey="guest">
          {({ navigation }) => <GuestAccountScreen navigation={navigation} tab="ActivityTab" />}
        </ActivityStackNav.Screen>
      )}
    </ActivityStackNav.Navigator>
  );
}

const ChatStackNav = createNativeStackNavigator();
function ChatStack() {
  const signedIn = useSessionStore((state) => !!state.profile);
  return (
    <ChatStackNav.Navigator screenOptions={{ headerShown: false }}>
      {signedIn ? (
        <ChatStackNav.Group navigationKey="account">
          <ChatStackNav.Screen name="ChatList">
            {(props) => <ChatListScreen {...props} role="customer" />}
          </ChatStackNav.Screen>
          <ChatStackNav.Screen name="ChatThread" component={ChatThreadScreen} />
        </ChatStackNav.Group>
      ) : (
        <ChatStackNav.Screen name="ChatList" navigationKey="guest">
          {({ navigation }) => <GuestAccountScreen navigation={navigation} tab="ChatTab" />}
        </ChatStackNav.Screen>
      )}
    </ChatStackNav.Navigator>
  );
}

const ProfileStackNav = createNativeStackNavigator();
function ProfileStack() {
  const signedIn = useSessionStore((state) => !!state.profile);
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      {signedIn ? (
        <ProfileStackNav.Group navigationKey="account">
          <ProfileStackNav.Screen name="ProfileHome" component={ProfileScreen} />
          <ProfileStackNav.Screen name="SavedProviders" component={SavedProvidersScreen} />
          <ProfileStackNav.Screen name="SavedLocations" component={SavedLocationsScreen} />
          <ProfileStackNav.Screen name="ProviderDetail" component={ProviderDetailScreen} />
          <ProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
          <ProfileStackNav.Screen name="Organizations" component={OrganizationsScreen} />
          <ProfileStackNav.Screen name="OrganizationDetail" component={OrganizationDetailScreen} />
          <ProfileStackNav.Screen name="AccountSecurity" component={AccountSecurityScreen} />
          <ProfileStackNav.Screen name="Notifications" component={NotificationsScreen} />
          <ProfileStackNav.Screen name="Appearance" component={AppearanceScreen} />
          <ProfileStackNav.Screen name="Referral" component={ReferralScreen} />
          <ProfileStackNav.Screen name="Legal" component={LegalScreen} />
          <ProfileStackNav.Screen name="BlockedUsers" component={BlockedUsersScreen} />
          <ProfileStackNav.Screen name="HelpSupport" component={HelpSupportScreen} />
        </ProfileStackNav.Group>
      ) : (
        <ProfileStackNav.Screen name="ProfileHome" navigationKey="guest">
          {({ navigation }) => <GuestAccountScreen navigation={navigation} tab="ProfileTab" />}
        </ProfileStackNav.Screen>
      )}
    </ProfileStackNav.Navigator>
  );
}

const tabs: TabSpec[] = [
  { name: 'HomeTab', component: HomeStack },
  { name: 'MapTab', component: MapStack },
  { name: 'ActivityTab', component: ActivityStack },
  { name: 'ChatTab', component: ChatStack },
  { name: 'ProfileTab', component: ProfileStack },
];

export function CustomerTabs() {
  return <AppTabs tabs={tabs} />;
}
