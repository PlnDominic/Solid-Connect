import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Location is helpful (nearby providers, arrival times, live job tracking)
 * but not required to use the app: everything that reads the phone's position
 * already falls back to the neighbourhood on the person's profile, and live
 * job tracking asks for permission at the moment it is needed. So a person
 * can choose to carry on without it, and that choice is remembered here
 * instead of showing the wall again on every launch.
 */
const KEY = 'solid-connect:location-skipped';

export async function wasLocationSkipped(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setLocationSkipped(skipped: boolean): Promise<void> {
  try {
    if (skipped) await AsyncStorage.setItem(KEY, '1');
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Not remembering the choice only means the screen can show once more.
  }
}
