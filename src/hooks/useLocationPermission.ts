import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
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
    return () => sub.remove();
  }, [refresh]);

  /** Shows the system prompt. Resolves true only when access was granted. */
  const request = useCallback(async (): Promise<boolean> => {
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      apply(result);
      return result.granted;
    } catch {
      setState('denied');
      return false;
    }
  }, [apply]);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  return { state, canAskAgain, request, openSettings, refresh };
}
