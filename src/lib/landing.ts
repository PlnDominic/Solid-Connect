import AsyncStorage from '@react-native-async-storage/async-storage';

const SPLASH_KEY = 'solid-connect:has-seen-splash';
const LANDING_KEY = 'solid-connect:has-seen-landing';

/**
 * First-run funnel on a signed-out device:
 * - Brand-new install → splash → marketing onboarding → sign-in / sign-up
 * - Saw splash but hasn't finished onboarding → onboarding only (no splash replay)
 * - Finished onboarding, signed in, or signed out once → sign-in only
 */

export async function hasSeenSplash(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SPLASH_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markSplashSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SPLASH_KEY, '1');
  } catch {
    // Best-effort.
  }
}

/** True after the marketing landing is done (or the user has authenticated / signed out). */
export async function hasSeenLanding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LANDING_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Mark the marketing landing as done so later visits go straight to sign-in. */
export async function markLandingSeen(): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [LANDING_KEY, '1'],
      [SPLASH_KEY, '1'],
    ]);
  } catch {
    // Best-effort; worst case they see the landing once more.
  }
}

/**
 * Where a signed-out cold start should begin.
 * Splash is only for a true first launch on this device.
 */
export async function getSignedOutStartPhase(): Promise<'splash' | 'onboarding' | 'signin'> {
  if (await hasSeenLanding()) return 'signin';
  if (await hasSeenSplash()) return 'onboarding';
  return 'splash';
}
