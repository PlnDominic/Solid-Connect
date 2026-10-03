import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'solid-connect:has-seen-landing';

/** True after the first-run landing has been completed (or the user has signed out once). */
export async function hasSeenLanding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Mark the marketing landing as done so later visits go straight to sign-in. */
export async function markLandingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Best-effort; worst case they see the landing once more.
  }
}
