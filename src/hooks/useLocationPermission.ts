import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
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
  // True while request() is showing system pop-ups. iOS moves the app to
  // 'inactive' and back for every system alert; re-checking then would
  // race the request and could drop its result.
  const requesting = useRef(false);

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
    if (requesting.current) return;
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

  const openSettings = useCallback(() => {
    if (isWeb) {
      if (typeof window !== 'undefined') window.location.reload();
      return;
    }
    Linking.openSettings().catch(() => {});
  }, [isWeb]);

  /** iPhone: straight to Settings > Privacy & Security > Location Services
   * when iOS allows it, otherwise the app's own Settings page. */
  const openLocationServicesSettings = useCallback(() => {
    if (Platform.OS !== 'ios') return openSettings();
    Linking.openURL('App-Prefs:Privacy&path=LOCATION').catch(() => openSettings());
  }, [openSettings]);

  /** A pop-up with an Open Settings button, for the cases no system dialog
   * can fix from inside the app. */
  const promptSettings = useCallback(
    (title: string, message: string, onOpen: () => void = openSettings) => {
      Alert.alert(title, message, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: onOpen },
      ]);
    },
    [openSettings],
  );

  /**
   * Turns location on, step by step, with a pop-up at each step:
   * 1. the system "Allow location?" permission prompt;
   * 2. on Android, the system "Turn on device location" dialog, which
   *    switches the phone's location on right there;
   * 3. on iPhone (where apps can't switch Location Services on), a pop-up
   *    that opens Settings.
   * Resolves true only when location is actually usable.
   */
  const request = useCallback(async (): Promise<boolean> => {
    setAttempted(true);
    requesting.current = true;
    const mine = ++seq.current;
    try {
      // iPhone: with Location Services switched off for the whole phone,
      // no app permission prompt can help, so say that first.
      if (Platform.OS === 'ios' && !(await Location.hasServicesEnabledAsync().catch(() => true))) {
        await evaluate(await Location.getForegroundPermissionsAsync(), mine);
        if (mine === seq.current) setState('services_off');
        promptSettings(
          'Turn on Location Services',
          'Location Services are off on this iPhone. In Settings, go to Privacy & Security > Location Services and switch it on, then come back.',
          openLocationServicesSettings,
        );
        return false;
      }

      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && (perm.canAskAgain || isWeb)) {
        perm = await Location.requestForegroundPermissionsAsync();
      }

      if (!perm.granted) {
        await evaluate(perm, mine);
        if (!isWeb && !perm.canAskAgain) {
          promptSettings(
            'Allow location access',
            Platform.OS === 'ios'
              ? 'Location is not allowed for this app. In Settings, tap Location and choose "While Using the App". (In Expo Go this is the Expo Go app setting.)'
              : 'Location access is off for this app. Open Settings, tap Location, and choose "While using the app".',
          );
        }
        return false;
      }
      if (isWeb) {
        await evaluate(perm, mine);
        return true;
      }

      if (Platform.OS === 'android') {
        // Shows Google's "Turn on device location" dialog when location (or
        // the network provider it needs) is off; resolves at once if it's on.
        await Location.enableNetworkProviderAsync().catch(() => {});
      }

      const on = await Location.hasServicesEnabledAsync().catch(() => true);
      await evaluate(perm, mine);
      if (!on) {
        promptSettings(
          'Turn on location',
          Platform.OS === 'ios'
            ? 'Location Services are off on this iPhone. Open Settings > Privacy & Security > Location Services and switch them on.'
            : 'Location is off on this phone. Switch on Location in Settings (or from the quick settings panel), then come back.',
          openLocationServicesSettings,
        );
        return false;
      }
      return true;
    } catch {
      if (mine === seq.current) setState('denied');
      return false;
    } finally {
      requesting.current = false;
    }
  }, [evaluate, isWeb, promptSettings, openLocationServicesSettings]);

  // A browser never shows its prompt twice, and there's no Settings screen
  // to send someone to, so on the web a refusal is final until reload.
  const blocked = state === 'denied' && isWeb;

  const helpText =
    state === 'services_off'
      ? Platform.OS === 'ios'
        ? 'Location Services are turned off on this phone. Open Settings > Privacy & Security > Location Services and turn them on.'
        : 'Location is turned off on this phone. Tap the button and turn it on, or switch on Location from the quick settings.'
      : blocked || (state === 'denied' && !canAskAgain)
        ? isWeb
          ? 'Your browser is blocking location. Click the lock or tune icon next to the address bar, set Location to Allow, then press Reload.'
          : 'Location is turned off for this app. Open Settings, choose Location, and allow access while using the app. In Expo Go, this is the Expo Go app\'s own setting.'
        : 'Solid Connect needs your location to work. Please allow access to continue.';

  return { state, canAskAgain, blocked, attempted, isWeb, helpText, request, openSettings, refresh };
}
