import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { en, type TranslationKey } from './en';
import { tw } from './tw';
import { ga } from './ga';
import { LOCALE_LABELS, type Locale } from './locales';

const STORAGE_KEY = 'solid-connect:locale';

const dictionaries: Record<Locale, Partial<Record<TranslationKey, string>>> = { en, tw, ga };

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey) => string;
  loaded: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

// Neither Twi nor Ga ships as a selectable OS language on the phones sold
// here, so in practice this always resolves to 'en' today - it's forward
// cover for a future device that does report one of them, not something
// that changes anyone's experience right now.
function detectDefaultLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode;
  if (tag === 'tw' || tag === 'ak') return 'tw';
  if (tag === 'ga') return 'ga';
  return 'en';
}

/** Device-local language preference, same pattern as the theme and
 * biometric-lock preferences - never synced, since it only describes this
 * device's UI. Wraps the whole app so any screen can call useLocale(). */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: string | null = null;
      try {
        stored = await AsyncStorage.getItem(STORAGE_KEY);
      } catch {
        // best-effort
      }
      if (cancelled) return;
      setLocaleState(stored === 'en' || stored === 'tw' || stored === 'ga' ? stored : detectDefaultLocale());
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // best-effort
    });
  }

  const t = useMemo(() => {
    const dict = dictionaries[locale];
    return (key: TranslationKey): string => dict[key] ?? en[key];
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, loaded }), [locale, loaded, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}

export { LOCALE_LABELS };
export type { Locale, TranslationKey };
