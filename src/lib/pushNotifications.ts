import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getNotifications } from './runtime';

// Show pushes as banners even while the app is open.
getNotifications()?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushPermissionStatus = 'granted' | 'denied' | 'skipped';

/**
 * Requests OS notification permission and, if granted, the device's Expo
 * push token. The token needs an EAS projectId (run `eas init`); until then
 * this yields a null token instead of throwing. Delivery is done
 * server-side by the notifications_send_push trigger (migration 0043).
 * Where push isn't available (Expo Go on Android, web) it reports 'skipped'.
 */
export async function registerForPushNotificationsAsync(): Promise<{
  status: PushPermissionStatus;
  token: string | null;
}> {
  const Notifications = getNotifications();
  if (!Notifications) return { status: 'skipped', token: null };

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (status !== 'granted') return { status: 'denied', token: null };

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return { status: 'granted', token: null };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: data };
  } catch {
    // No push capability on this device/simulator; the permission outcome
    // (if we got that far) is still worth keeping, so report granted.
    return { status: 'granted', token: null };
  }
}
