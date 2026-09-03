import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Not typed against our Database schema (see src/types/database.ts) — the
// hand-written types don't match supabase-js v2's stricter generic schema
// shape (Views/Functions/Enums/CompositeTypes, Relationships, etc.), so
// passing it here as the client generic fights the type-checker everywhere
// a query is built. Each src/api/* function instead declares its own
// return type, which is where callers actually get type safety. Once the
// live project exists, regenerate with `supabase gen types typescript` and
// this can go back to `createClient<Database>(...)`.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
