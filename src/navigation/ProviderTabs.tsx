import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FeedScreen } from '../screens/provider/FeedScreen';
import { RequestDetailScreen } from '../screens/provider/RequestDetailScreen';
import { JobsScreen } from '../screens/provider/JobsScreen';
import { JobDetailScreen } from '../screens/provider/JobDetailScreen';
import { ProfileScreen } from '../screens/provider/ProfileScreen';
import { PayoutDetailsScreen } from '../screens/provider/PayoutDetailsScreen';
import { ServiceAreasScreen } from '../screens/provider/ServiceAreasScreen';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { ChatThreadScreen } from '../screens/shared/ChatThreadScreen';
import { EditProfileScreen } from '../screens/shared/EditProfileScreen';
import { HelpSupportScreen } from '../screens/shared/HelpSupportScreen';
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

const JobsStackNav = createNativeStackNavigator();
function JobsStack() {
  return (
    <JobsStackNav.Navigator screenOptions={{ headerShown: false }}>
      <JobsStackNav.Screen name="JobsHome" component={JobsScreen} />
      <JobsStackNav.Screen name="JobDetail" component={JobDetailScreen} />
    </JobsStackNav.Navigator>
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
      <ProfileStackNav.Screen name="PayoutDetails" component={PayoutDetailsScreen} />
      <ProfileStackNav.Screen name="ServiceAreas" component={ServiceAreasScreen} />
      <ProfileStackNav.Screen name="HelpSupport" component={HelpSupportScreen} />
    </ProfileStackNav.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function ProviderTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="FeedTab" component={FeedStack} options={{ tabBarLabel: 'Feed' }} />
      <Tab.Screen name="JobsTab" component={JobsStack} options={{ tabBarLabel: 'Jobs' }} />
      <Tab.Screen name="ChatTab" component={ChatStack} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
