import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { clearProviderPresence, reportProviderPresence } from '../api/map';
import { useMyAvailabilityMode } from '../hooks/useMyAvailabilityMode';

const MIN_SEND_GAP_MS = 30_000;
// Under map_providers' 10-minute cut-off, so a provider standing still
// stays on the map.
const HEARTBEAT_MS = 3 * 60_000;

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Renders nothing. While a provider is "Available now" and has the app
 * open, keeps their approximate position on the live map (the server snaps
 * it to a ~450 m grid - see 0067). Foreground only: no background location
 * permission is asked for, so a provider who closes the app drops off the
 * map once their last update is 10 minutes old. Switching away from
 * "Available now" removes them straight away.
 *
 * Mounted inside ProviderTabs, so it only ever runs for a signed-in
 * provider. Location permission is already required by LocationGate; if it
 * is missing anyway this quietly does nothing rather than prompting.
 */
export function PresenceSync() {
  const mode = useMyAvailabilityMode();
  const appActive = useAppActive();
  const available = mode === 'AVAILABLE_NOW';
  const wasAvailable = useRef(false);

  useEffect(() => {
    if (wasAvailable.current && !available) {
      clearProviderPresence().catch(() => {});
    }
    wasAvailable.current = available;
  }, [available]);

  useEffect(() => {
    if (!available || !appActive) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let last: { lat: number; lng: number } | null = null;
    let lastSentAt = 0;

    function stop() {
      cancelled = true;
      subscription?.remove();
      subscription = null;
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
    }

    function send(force: boolean) {
      if (cancelled || !last) return;
      const now = Date.now();
      if (!force && now - lastSentAt < MIN_SEND_GAP_MS) return;
      lastSentAt = now;
      reportProviderPresence(last.lat, last.lng)
        .then((visible) => {
          // The server is the authority on eligibility (e.g. the mode was
          // changed on another device); stop until this screen re-renders.
          if (!visible) stop();
        })
        .catch((e) => console.warn('[PresenceSync] report failed:', e?.message ?? e));
    }

    (async () => {
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm?.granted || cancelled) return;

      const known = await Location.getLastKnownPositionAsync().catch(() => null);
      if (known && !cancelled) {
        last = { lat: known.coords.latitude, lng: known.coords.longitude };
        send(true);
      }

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 100 },
        (position) => {
          last = { lat: position.coords.latitude, lng: position.coords.longitude };
          send(false);
        },
      ).catch(() => null);
      if (cancelled) {
        sub?.remove();
        return;
      }
      subscription = sub;
      heartbeat = setInterval(() => send(true), HEARTBEAT_MS);
    })();

    return stop;
  }, [available, appActive]);

  return null;
}
