import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';

type LocaleContextValue = {
  t: (key: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** The app currently ships in English. Keeping the translation lookup
 * central makes adding a reviewed locale later a contained change. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ t: (key: TranslationKey) => en[key] }), []);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}

/** Which greeting fits a local hour: morning 5-11, afternoon 12-16, evening otherwise. */
export function greetingKeyForHour(hour: number): TranslationKey {
  if (hour >= 5 && hour < 12) return 'home.greetingMorning';
  if (hour >= 12 && hour < 17) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

/** "Good morning" / "Good afternoon" / "Good evening" from the device clock,
 * re-checked every minute so it changes while the app stays open. */
export function useGreeting(): string {
  const { t } = useLocale();
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);
  return t(greetingKeyForHour(hour));
}

export type { TranslationKey };
