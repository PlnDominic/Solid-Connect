import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import type { LinkingOptions } from '@react-navigation/native';

// Only the destinations the app actually lets someone share externally:
// a provider's profile, a job (and its receipt), and the referral screen.
// Chat threads are deliberately left out - ChatThreadScreen needs both a
// threadId and a peerId, and a raw shared URL can only ever carry the
// former, so a link into a specific conversation would need a lookup this
// app doesn't have yet.
//
// CustomerTabs and ProviderTabs are two different Tab.Navigators mounted
// one-at-a-time behind the same "Main" stack screen (see RootNavigator),
// so a path is only reachable while the matching role's tree is actually
// mounted - e.g. a providers/:id link opens straight to the right screen
// for a signed-in customer, and simply doesn't resolve for a provider,
// who has no such screen to send it to.
function urlFromPush(response: Notifications.NotificationResponse | null | undefined): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' ? url : null;
}

export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [Linking.createURL('/'), 'solidconnect://'],
  // Tapping a push opens the screen named in its payload, whether the app
  // was killed (getInitialURL) or already running (subscribe).
  async getInitialURL() {
    const pushUrl = urlFromPush(await Notifications.getLastNotificationResponseAsync());
    return pushUrl ?? Linking.getInitialURL();
  },
  subscribe(listener) {
    const linkSub = Linking.addEventListener('url', ({ url }) => listener(url));
    const pushSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = urlFromPush(response);
      if (url) listener(url);
    });
    return () => {
      linkSub.remove();
      pushSub.remove();
    };
  },
  config: {
    screens: {
      Main: {
        screens: {
          HomeTab: {
            screens: {
              ProviderDetail: 'providers/:providerId',
            },
          },
          JobsTab: {
            screens: {
              JobDetail: 'jobs/:jobId',
              Receipt: 'jobs/:jobId/receipt',
            },
          },
          ProfileTab: {
            screens: {
              Referral: 'referral',
              Notifications: 'notifications',
            },
          },
        },
      },
    },
  },
};
