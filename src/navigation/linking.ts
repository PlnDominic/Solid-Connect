import * as Linking from 'expo-linking';
import type { NotificationResponse } from 'expo-notifications';
import type { LinkingOptions } from '@react-navigation/native';
import { getNotifications } from '../lib/runtime';

// Only the destinations the app actually lets someone share externally:
// a provider's profile, a job (and its receipt), the referral screen, and
// referral invite links (solidconnect://referral?code=XXXX, which open the
// Referral screen; the code itself is captured by AuthFlowScreen's link
// listener and claimed after sign-up).
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
function urlFromPush(response: NotificationResponse | null | undefined): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' ? url : null;
}

export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [Linking.createURL('/'), 'solidconnect://'],
  // Tapping a push opens the screen named in its payload, whether the app
  // was killed (getInitialURL) or already running (subscribe).
  // Push is unavailable in some runtimes (Expo Go on Android), and a
  // rejected getInitialURL would stop navigation from starting, so every
  // push step here is optional and can't throw.
  async getInitialURL() {
    let pushUrl: string | null = null;
    try {
      pushUrl = urlFromPush(await getNotifications()?.getLastNotificationResponseAsync());
    } catch {
      pushUrl = null;
    }
    return pushUrl ?? (await Linking.getInitialURL());
  },
  subscribe(listener) {
    const linkSub = Linking.addEventListener('url', ({ url }) => listener(url));
    let pushSub: { remove: () => void } | null = null;
    try {
      pushSub =
        getNotifications()?.addNotificationResponseReceivedListener((response) => {
          const url = urlFromPush(response);
          if (url) listener(url);
        }) ?? null;
    } catch {
      pushSub = null;
    }
    return () => {
      linkSub.remove();
      pushSub?.remove();
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
              Dispute: 'jobs/:jobId/dispute',
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
