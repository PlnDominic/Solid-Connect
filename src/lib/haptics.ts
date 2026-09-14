import * as Haptics from 'expo-haptics';

// Haptics aren't available on every device (web, some Android configs,
// simulators) - a vibration failing must never interrupt the action it
// was celebrating, so every call is swallowed the same way the app
// already swallows best-effort AsyncStorage writes elsewhere.
async function safe(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    // best-effort
  }
}

export const haptics = {
  /** A message sent, a light tap-level acknowledgement. */
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A quote arriving, a job being accepted - something worth noticing. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
