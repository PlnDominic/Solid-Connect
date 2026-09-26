import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

export type LocationPermissionState = 'checking' | 'granted' | 'denied' | 'undetermined' | 'services_off';

/**
 * The phone's real location access: the app permission AND the device's
 * location switch (a granted permission is useless with location off).
 * Re-checks when the app returns to the foreground, so changing either in
 * Settings takes effect the moment the person comes back.
 */
export function useLocationPermission() {
  const [state, setState] = useState<LocationPermissionState>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const isWeb = Platform.OS === 'web';
  // Each check gets a number; only the newest one may update state. On iOS
  // the permission alert itself flips AppState to inactive/active, which
  // starts a background re-check that can finish *after* the prompt and
  // overwrite a fresh "granted" with the stale "undetermined".
  const seq = useRef(0);

  const evaluate = useCallback(async (p: Location.LocationPermissionResponse, mine: number) => {
    let next: LocationPermissionState;
    if (!p.granted) {
      next = p.status === Location.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied';
    } else if (isWeb) {
      next = 'granted';
    } else {
      const on = await Location.hasServicesEnabledAsync().catch(() => true);
      next = on ? 'granted' : 'services_off';
    }
    if (mine !== seq.current) return;
    setCanAskAgain(p.canAskAgain);
    setState(next);
  }, [isWeb]);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      await evaluate(await Location.getForegroundPermissionsAsync(), mine);
    } catch {
      if (mine === seq.current) setState('denied');
    }
  }, [evaluate]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    // Browsers report a permission change (e.g. allowed from the address
    // bar) without the app ever leaving the foreground.
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

  /** Shows the system prompt (or Android's "turn on location" dialog).
   * Resolves true only when location is actually usable. */
  const request = useCallback(async (): Promise<boolean> => {
    setAttempted(true);
    const mine = ++seq.current;
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.granted && !isWeb && Platform.OS === 'android' && !(await Location.hasServicesEnabledAsync())) {
        await Location.enableNetworkProviderAsync().catch(() => {});
      }
      await evaluate(result, mine);
      const usable = result.granted && (isWeb || (await Location.hasServicesEnabledAsync().catch(() => true)));
      return usable;
    } catch {
      if (mine === seq.current) setState('denied');
      return false;
    }
  }, [evaluate, isWeb]);

  // A browser never shows its prompt twice, and there's no Settings screen
  // to send someone to, so on the web a refusal is final until reload.
  const blocked = (state === 'denied' && (!canAskAgain || isWeb)) || (state === 'services_off' && Platform.OS === 'ios');

  const openSettings = useCallback(() => {
    if (isWeb) {
      if (typeof window !== 'undefined') window.location.reload();
      return;
    }
    Linking.openSettings().catch(() => {});
  }, [isWeb]);

  const helpText =
    state === 'services_off'
      ? Platform.OS === 'ios'
        ? 'Location Services are turned off on this phone. Open Settings > Privacy & Security > Location Services and turn them on.'
        : 'Location is turned off on this phone. Tap the button and turn it on, or switch on Location from the quick settings.'
      : blocked
        ? isWeb
          ? 'Your browser is blocking location. Click the lock or tune icon next to the address bar, set Location to Allow, then press Reload.'
          : 'Location is turned off for this app. Open Settings, choose Location, and allow access while using the app. In Expo Go, this is the Expo Go app\'s own setting.'
        : 'Solid Connect needs your location to work. Please allow access to continue.';

  return { state, canAskAgain, blocked, attempted, isWeb, helpText, request, openSettings, refresh };
}
