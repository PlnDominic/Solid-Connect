import { Platform } from 'react-native';
import * as Location from 'expo-location';

export type PositionResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'PERMISSION_DENIED' | 'SERVICES_OFF' | 'UNAVAILABLE' };

const FIX_TIMEOUT_MS = 12_000;

/**
 * The phone's current position, never hanging. getCurrentPositionAsync can
 * wait indefinitely indoors or with location switched off, so this checks
 * that location services are on (offering Android's "turn on location"
 * dialog), prefers a recent cached fix, then races a fresh fix against a
 * timeout.
 */
export async function getDevicePosition(): Promise<PositionResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'PERMISSION_DENIED' };

    // Android: prompt to enable device location / network provider when off.
    if (Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        // User dismissed the system dialog, or services stay off.
      }
    }

    if (!(await Location.hasServicesEnabledAsync())) {
      return { ok: false, reason: 'SERVICES_OFF' };
    }

    // Prefer a recent cached fix if it's already street-level accurate.
    // Matching uses this point in PostGIS — don't accept a km-scale guess.
    const last = await Location.getLastKnownPositionAsync({
      maxAge: 60_000,
      requiredAccuracy: 80,
    }).catch(() => null);
    if (last?.coords) {
      return { ok: true, lat: last.coords.latitude, lng: last.coords.longitude };
    }

    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        // Android: offer the "improve location accuracy" settings dialog.
        mayShowUserSettingsDialog: true,
      }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    const coords =
      fresh?.coords ??
      (await Location.getLastKnownPositionAsync().catch(() => null))?.coords;
    if (!coords) return { ok: false, reason: 'UNAVAILABLE' };
    return { ok: true, lat: coords.latitude, lng: coords.longitude };
  } catch {
    return { ok: false, reason: 'UNAVAILABLE' };
  }
}
