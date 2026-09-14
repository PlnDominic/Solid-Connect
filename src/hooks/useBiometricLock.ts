import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const STORAGE_KEY = 'solid-connect:biometric-lock-enabled';

/** Device-local preference, same pattern as recently-viewed providers -
 * never synced, since it's meaningless on any device but this one. */
async function readEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}

async function writeEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // best-effort
  }
}

/**
 * Hardware capability plus the person's own on/off choice for locking the
 * app behind Face ID / Touch ID / fingerprint. `available` reflects the
 * device (has a sensor and has something enrolled) - the toggle in
 * Account Security is hidden entirely when this is false, since there's
 * nothing to turn on. `enabled` is only ever true when the person
 * explicitly turned it on AND successfully authenticated once to confirm
 * it (see AccountSecurityScreen), so a stale AsyncStorage flag can never
 * lock someone out of an app with no working biometrics.
 */
export function useBiometricLockPreference() {
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [hasHardware, isEnrolled, storedEnabled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        readEnabled(),
      ]);
      if (cancelled) return;
      const isAvailable = hasHardware && isEnrolled;
      setAvailable(isAvailable);
      setEnabledState(isAvailable && storedEnabled);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function setEnabled(value: boolean) {
    setEnabledState(value);
    await writeEnabled(value);
  }

  return { enabled, available, loaded, setEnabled };
}

/** One authentication prompt, boiled down to a boolean - used both by the
 * settings toggle (confirm before turning on) and the app lock screen. */
export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
