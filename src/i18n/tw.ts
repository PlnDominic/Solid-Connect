import type { TranslationKey } from './en';

// Best-effort Twi (Akan) translations for the strings currently wired up
// to the translation system - see index.ts for how a missing key falls
// back to English. NOT reviewed by a native speaker; treat this as a
// starting vocabulary to correct, not a finished localization.
export const tw: Partial<Record<TranslationKey, string>> = {
  'tab.home': 'Fie',
  'tab.feed': 'Nsɛm',
  'tab.requests': 'Abisadeɛ',
  'tab.jobs': 'Adwuma',
  'tab.chat': 'Nkɔmmɔdie',
  'tab.profile': 'Wo Ho Nsɛm',

  'common.save': 'Sie',
  'common.cancel': 'Twa Mu',
  'common.back': 'San Kɔ',
  'common.retry': 'Sɔ Bio',
  'common.accept': 'Penso',
  'common.decline': 'Pow',
  'common.edit': 'Sesa',
  'common.share': 'Kyɛ',
  'common.done': 'Awie',

  'home.greeting': 'Akwaaba',
  'home.startRequest': 'Fi Abisadeɛ Ase',
  'home.chooseCategory': 'Paw Adwuma Su',

  'settings.language': 'Kasa',
  'settings.languageIntro': 'Paw kasa a wopɛ ma akwankyerɛ ne nsɛntitiriw. App no nkaeɛ da so ka Borɔfo kɔsi sɛ wɔbɛkyerɛ nkaeɛ no nyinaa ase.',
};
