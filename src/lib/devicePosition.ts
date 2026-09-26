import { Platform } from 'react-native';
import * as Location from 'expo-location';

export type PositionResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'PERMISSION_DENIED' | 'SERVICES_OFF' | 'UNAVAILABLE' };

const FIX_TIMEOUT_MS = 8000;

/**
 * The phone's current position, never hanging. getCurrentPositionAsync can
 * wait indefinitely indoors or with location switched off, so this checks
 * that location services are on (offering Android's "turn on location"
 * dialog), races a fresh fix against a timeout, and falls back to the last
 * known position.
 */
export async function getDevicePosition(): Promise<PositionResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'PERMISSION_DENIED' };

    if (!(await Location.hasServicesEnabledAsync())) {
      if (Platform.OS !== 'android') return { ok: false, reason: 'SERVICES_OFF' };
      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        return { ok: false, reason: 'SERVICES_OFF' };
      }
    }

    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    const coords = fresh?.coords ?? (await Location.getLastKnownPositionAsync().catch(() => null))?.coords;
    if (!coords) return { ok: false, reason: 'UNAVAILABLE' };
    return { ok: true, lat: coords.latitude, lng: coords.longitude };
  } catch {
    return { ok: false, reason: 'UNAVAILABLE' };
  }
}
