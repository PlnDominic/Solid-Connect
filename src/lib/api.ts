import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Expo Go on a physical device cannot reach the Nest API via localhost
 * (that points at the phone). Rewrite to the same LAN host Metro uses.
 */
function resolveApiUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  if (!configured) return '';

  const isLoopback =
    /:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(configured) ||
    configured.startsWith('localhost') ||
    configured.startsWith('127.0.0.1');
  if (!isLoopback) return configured;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2
      ?.extra?.expoGo?.debuggerHost ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    null;
  const metroHost = hostUri?.split(':')[0]?.trim();
  if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
    return configured.replace(/localhost|127\.0\.0\.1/gi, metroHost);
  }

  // Android emulator (no Metro LAN host) reaches the host via 10.0.2.2
  if (Platform.OS === 'android') {
    return configured.replace(/localhost|127\.0\.0\.1/gi, '10.0.2.2');
  }

  return configured;
}

const API_URL = resolveApiUrl();

export function isApiConfigured() {
  return Boolean(API_URL);
}

export function getApiBaseUrl() {
  return API_URL;
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set. Add it to .env and restart Expo.');
  }
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.auth !== false) {
    const token = await accessToken();
    if (!token) throw new Error('Not signed in');
    headers.set('Authorization', `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Cannot reach API at ${API_URL}. Is Nest running (port 3001) and is the phone on the same network? (${detail})`,
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message ?? body?.message ?? `API ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}
