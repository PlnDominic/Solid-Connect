import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushPermissionStatus = 'granted' | 'denied' | 'skipped';

/**
 * Requests OS notification permission and, if granted, the device's Expo
 * push token - for job/quote alerts once a backend actually sends them.
 * There's no EAS project linked in this repo yet (no eas.json), so
 * getExpoPushTokenAsync has no projectId to call with; that's expected
 * right now, not a bug - it's wrapped so a missing/invalid projectId just
 * yields a null token instead of throwing. The permission outcome itself
 * is still real and worth recording either way.
 */
export async function registerForPushNotificationsAsync(): Promise<{
  status: PushPermissionStatus;
  token: string | null;
}> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (status !== 'granted') {
    return { status: 'denied', token: null };
  }

  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return { status: 'granted', token: null };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: data };
  } catch {
    // No linked EAS project, no push capability on this device/simulator,
    // etc. - the permission itself was still granted and worth keeping.
    return { status: 'granted', token: null };
  }
}
