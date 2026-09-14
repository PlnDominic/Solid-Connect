// Ghana-only launch market: English plus the two most widely spoken local
// languages in Accra. Adding a fourth locale is just a new dictionary file
// plus one entry in LOCALE_LABELS and `dictionaries` (see index.ts) - no
// other code changes.
export type Locale = 'en' | 'tw' | 'ga';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  tw: 'Twi',
  ga: 'Ga',
};
