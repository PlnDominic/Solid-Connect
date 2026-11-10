import Constants from 'expo-constants';
import { supabase } from './supabase';
import { useSessionStore } from '../store/useSessionStore';

/**
 * Crash and error reporting without a third-party SDK: reports go to the
 * client_errors table (migration 0061, admin page /errors), which RLS limits
 * to inserts and rate limits per user. Nothing here may ever throw or block,
 * so every step is wrapped, and the same error is only sent once per run.
 */
const sent = new Set<string>();
let currentScreen: string | null = null;

export function setCurrentScreen(name: string | null) {
  currentScreen = name;
}

export async function reportError(error: unknown, opts: { fatal?: boolean } = {}): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const message = (err.message || 'Unknown error').slice(0, 1000);
    const key = `${message}|${(err.stack ?? '').slice(0, 200)}`;
    if (sent.has(key)) return;
    sent.add(key);
    if (sent.size > 100) sent.clear();
    await supabase.from('client_errors').insert({
      user_id: useSessionStore.getState().profile?.id ?? null,
      message,
      stack: err.stack ? err.stack.slice(0, 8000) : null,
      fatal: !!opts.fatal,
      platform: process.env.EXPO_OS ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      screen: currentScreen?.slice(0, 120) ?? null,
    });
  } catch {
    // Reporting must never cause a second failure.
  }
}

let installed = false;

/** Catches errors React's boundary cannot: event handlers, timers and rejected promises. */
export function installGlobalErrorReporting() {
  if (installed) return;
  installed = true;
  try {
    const errorUtils = (globalThis as any).ErrorUtils;
    const previous = errorUtils?.getGlobalHandler?.();
    errorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
      void reportError(error, { fatal: !!isFatal });
      previous?.(error, isFatal);
    });
    const tracking = (globalThis as any).HermesInternal?.enablePromiseRejectionTracker;
    tracking?.({
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => void reportError(rejection),
    });
  } catch {
    // Older runtimes without these hooks just skip global reporting.
  }
}
