import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'solid-connect:recently-viewed-providers';
const MAX_ENTRIES = 8;

/** Best-effort, device-local only - not synced anywhere, never blocks
 * actually viewing the provider if the write fails. */
export async function recordProviderView(providerId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = [providerId, ...ids.filter((id) => id !== providerId)].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

async function getRecentlyViewedProviderIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Most-recent-first provider ids, re-read from AsyncStorage every time the
 * calling screen regains focus (e.g. returning from a provider's detail
 * page) - cheap enough that a dedicated cache/store isn't worth it for
 * something this small and purely local.
 */
export function useRecentlyViewedProviderIds(): string[] {
  const [ids, setIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getRecentlyViewedProviderIds().then((next) => {
        if (!cancelled) setIds(next);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return ids;
}
