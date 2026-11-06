import { createContext, useContext, useMemo, type ReactNode } from 'react';
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

export type { TranslationKey };
