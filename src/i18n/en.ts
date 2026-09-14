// The canonical dictionary - every other locale is a Partial<> of this one
// and falls back to these strings for any key it doesn't yet cover, so
// adding a key here is always safe even before translating it elsewhere.
export const en = {
  'tab.home': 'Home',
  'tab.feed': 'Feed',
  'tab.requests': 'Requests',
  'tab.jobs': 'Jobs',
  'tab.chat': 'Chat',
  'tab.profile': 'Profile',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.retry': 'Retry',
  'common.accept': 'Accept',
  'common.decline': 'Decline',
  'common.edit': 'Edit',
  'common.share': 'Share',
  'common.done': 'Done',

  'home.greeting': 'Good morning',
  'home.startRequest': 'Start a request',
  'home.chooseCategory': 'Choose a category',

  'settings.language': 'Language',
  'settings.languageIntro': 'Choose the language for navigation and key screens. The rest of the app still reads in English while translation coverage grows.',
} as const;

export type TranslationKey = keyof typeof en;
