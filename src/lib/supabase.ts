import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Not typed against our Database schema (see src/types/database.ts) - the
// hand-written types don't match supabase-js v2's stricter generic schema
// shape (Views/Functions/Enums/CompositeTypes, Relationships, etc.), so
// passing it here as the client generic fights the type-checker everywhere
// a query is built. Each src/api/* function instead declares its own
// return type, which is where callers actually get type safety. Once the
// live project exists, regenerate with `supabase gen types typescript` and
// this can go back to `createClient<Database>(...)`.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * False when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY didn't
 * make it into process.env - most commonly because the app wasn't fully
 * restarted (not just reloaded) after creating/editing .env, since Expo
 * inlines EXPO_PUBLIC_* vars at bundle time. AuthFlowScreen checks this and
 * shows a legible in-app message; without this guard, supabase-js throws
 * synchronously at import time and the whole app crashes before it can
 * render anything.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in a .env file at the project root, then fully restart with `npx expo start -c` (a reload is not enough).'
  );
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
