import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export type LocationPermissionState = 'checking' | 'granted' | 'denied' | 'undetermined';

/**
 * The phone's real location permission. Re-checks whenever the app comes
 * back to the foreground, so granting it from the system Settings screen
 * (after being sent there) takes effect the moment the person returns.
 */
export function useLocationPermission() {
  const [state, setState] = useState<LocationPermissionState>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const isWeb = Platform.OS === 'web';

  const apply = useCallback((p: Location.LocationPermissionResponse) => {
    setCanAskAgain(p.canAskAgain);
    setState(p.granted ? 'granted' : p.status === Location.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied');
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await Location.getForegroundPermissionsAsync());
    } catch {
      setState('denied');
    }
  }, [apply]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    // Browsers report a permission change (e.g. the person allowed it from
    // the address bar) without the app ever leaving the foreground.
    let permissionStatus: PermissionStatus | null = null;
    if (isWeb && typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          permissionStatus = status;
          status.onchange = () => refresh();
        })
        .catch(() => {});
    }
    return () => {
      sub.remove();
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [refresh, isWeb]);

  /** Shows the system prompt. Resolves true only when access was granted. */
  const request = useCallback(async (): Promise<boolean> => {
    setAttempted(true);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      apply(result);
      return result.granted;
    } catch {
      setState('denied');
      return false;
    }
  }, [apply]);

  // A browser never shows its location prompt a second time, and there is
  // no system Settings screen to send someone to, so on the web a refusal
  // is final until they change it in the address bar and reload.
  const blocked = state === 'denied' && (!canAskAgain || isWeb);

  const openSettings = useCallback(() => {
    if (isWeb) {
      if (typeof window !== 'undefined') window.location.reload();
      return;
    }
    Linking.openSettings().catch(() => {});
  }, [isWeb]);

  /** What to tell someone whose location is off, for this platform. */
  const helpText = blocked
    ? isWeb
      ? 'Your browser is blocking location. Click the lock or tune icon next to the address bar, set Location to Allow, then press Reload.'
      : 'Location is turned off for Solid Connect. Open Settings, choose Location, and allow access while using the app.'
    : 'Solid Connect needs your location to work. Please allow access to continue.';

  return { state, canAskAgain, blocked, attempted, isWeb, helpText, request, openSettings, refresh };
}
