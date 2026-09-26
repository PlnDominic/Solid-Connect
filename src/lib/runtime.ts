import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';

/** True when running inside the Expo Go app rather than a real build. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Expo Go on Android removed remote push support (SDK 53+); merely loading
 * expo-notifications there reports an error that covers the screen in
 * development. Everywhere else it works normally.
 */
export const pushSupported = Platform.OS !== 'web' && !(isExpoGo && Platform.OS === 'android');

let cached: typeof NotificationsModule | null | undefined;

/** expo-notifications, loaded only where it is supported; otherwise null. */
export function getNotifications(): typeof NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (!pushSupported) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as typeof NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}
