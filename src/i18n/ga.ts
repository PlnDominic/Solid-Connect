import type { TranslationKey } from './en';

// Best-effort Ga translations, same caveat as tw.ts: not reviewed by a
// native speaker, and Ga has even less precedent for app/tech vocabulary
// than Twi does, so treat this dictionary as a rougher first draft that
// needs a native speaker's pass before shipping to real Ga-speaking users.
export const ga: Partial<Record<TranslationKey, string>> = {
  'tab.home': 'Shĩa',
  'tab.feed': 'Feed',
  'tab.requests': 'Bimɔ',
  'tab.jobs': 'Nitsumɔ',
  'tab.chat': 'Wiemɔ',
  'tab.profile': 'Ohe Sane',

  'common.save': 'Kɛto',
  'common.cancel': 'Kpata',
  'common.back': 'Ku Sɛɛ',
  'common.retry': 'Bɔ Mli Ekoŋŋ',
  'common.accept': 'Kpɛlɛ',
  'common.decline': 'Kwa',
  'common.edit': 'Tsake',
  'common.share': 'Kɛgbala',
  'common.done': 'Ehe Eba',

  'home.greeting': 'Ojekoo',
  'home.startRequest': 'Je Bimɔ Shishi',
  'home.chooseCategory': 'Hala Nitsumɔ Krobo',

  'settings.language': 'Wiemɔ',
  'settings.languageIntro': 'Hala wiemɔ ni oosumɔ kɛha gbɛtsɔɔmɔi kɛ mlai titriwi. App lɛ nɔ krokomɛi baaya Blofo mli kɛyaashi atsɔɔ shishi fɛɛ.',
};
