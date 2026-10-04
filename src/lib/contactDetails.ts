/**
 * Spots contact details in a chat message: phone numbers (in digits or
 * words), bank / mobile-money account details, personal emails, social
 * media handles and platforms, and links. Contact details stay off the
 * chat so every booking and payment goes through Solid Connect (and so
 * nobody is pulled into an off-app deal). Mirrored server-side by
 * public.find_contact_details (0071, 0072), which strips anything the app
 * missed - keep the two rules in step.
 *
 * Rules:
 * - number words become digits first ("zero two four", "double five");
 * - a run of digits (spaces, dashes, dots, brackets and a leading + allowed
 *   between them) holding 9+ digits - a phone number or an account number;
 * - an account/bank/MoMo keyword alongside a run of 6+ digits;
 * - an email address, written out ("name at gmail dot com") or a mail
 *   provider named;
 * - an @handle or a social / messaging platform named;
 * - a web address.
 * Commas and slashes break a digit run, so prices ("GHS 1,500") and dates
 * ("12/10/2026") pass.
 */
export type ContactDetailKind = 'phone' | 'account' | 'email' | 'social' | 'link';

const DIGIT_RUN = /\+?\d[\d\s().-]*\d/g;
const ACCOUNT_WORDS = /\b(account|acct|a\/c|acc\s*no|momo|mobile\s*money|bank|iban|swift|sort\s*code)\b/i;

const NUMBER_WORDS: [RegExp, string][] = [
  [/\b(zero|oh)\b/gi, '0'],
  [/\bone\b/gi, '1'],
  [/\btwo\b/gi, '2'],
  [/\bthree\b/gi, '3'],
  [/\bfour\b/gi, '4'],
  [/\bfive\b/gi, '5'],
  [/\bsix\b/gi, '6'],
  [/\bseven\b/gi, '7'],
  [/\beight\b/gi, '8'],
  [/\bnine\b/gi, '9'],
];

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i;
// "john at gmail dot com", "john (at) yahoo (dot) com", "john[at]mail.com"
const SPELLED_EMAIL = /[a-z0-9._-]+\s*(\(at\)|\[at\]|\{at\}|\bat\b)\s*[a-z0-9-]+\s*(\(dot\)|\[dot\]|\{dot\}|\bdot\b|\.)\s*(com|net|org|gh|co|edu|io|me)\b/i;
const MAIL_PROVIDERS = /\b(gmail|g-mail|yahoo|hotmail|outlook|icloud|protonmail|ymail|aol)\b/i;

const HANDLE = /(^|[\s(:])@[a-z0-9_.]{3,}/i;
const SOCIAL_PLATFORMS =
  /\b(whats\s?app|watsapp|wats\s?app|telegram|instagram|insta|ig|facebook|fb|messenger|tiktok|tik\s?tok|snapchat|twitter|linkedin|wechat|viber)\b/i;

const LINK = /\b(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|gh|io|me|co|app|link|ly|biz|info)(\/\S*)?\b|\bwa\.me\b|\bx\.com\b|\bt\.me\b/i;

/** "zero two four", "double five" -> "0 2 4", "5 5", so spelled-out
 * numbers go through the same digit rules. */
export function numberWordsToDigits(text: string): string {
  let out = text;
  for (const [pattern, digit] of NUMBER_WORDS) out = out.replace(pattern, digit);
  return out
    .replace(/\bdouble\s+(\d)/gi, '$1 $1')
    .replace(/\btriple\s+(\d)/gi, '$1 $1 $1');
}

// The same words with no word boundaries, for numbers typed as one joined
// word ("Zerotwofourtwosix...") or mixed with digits ("zero2four..."). "oh"
// is left out: inside ordinary words ("john", "though") it is noise.
const JOINED_NUMBER_WORDS: [RegExp, string][] = [
  [/zero/gi, '0'],
  [/one/gi, '1'],
  [/two/gi, '2'],
  [/three/gi, '3'],
  [/four/gi, '4'],
  [/five/gi, '5'],
  [/six/gi, '6'],
  [/seven/gi, '7'],
  [/eight/gi, '8'],
  [/nine/gi, '9'],
];

/** Like numberWordsToDigits, but also inside joined-up words:
 * "Zerotwofourtwosix" -> "0 2 4 2 6". Only used when the strict pass finds
 * nothing, and only a 9+ digit run counts, so "someone" -> "some1" alone
 * never blocks a message. */
export function joinedNumberWordsToDigits(text: string): string {
  let out = text;
  for (const [pattern, digit] of JOINED_NUMBER_WORDS) out = out.replace(pattern, ` ${digit} `);
  return out
    .replace(/double\s*(\d)/gi, '$1 $1')
    .replace(/triple\s*(\d)/gi, '$1 $1 $1');
}

function digitRuns(text: string): string[] {
  return (text.match(DIGIT_RUN) ?? []).map((run) => run.replace(/\D/g, ''));
}

function looksLikePhone(digits: string): boolean {
  return (
    (digits.length === 10 && digits.startsWith('0')) ||
    (digits.length === 12 && digits.startsWith('233')) ||
    digits.length === 9
  );
}

/** The kind of contact detail in `text`, or null when there's none. */
function findNumber(normalized: string): 'phone' | 'account' | null {
  const runs = digitRuns(normalized);
  const hasAccountWord = ACCOUNT_WORDS.test(normalized);
  for (const digits of runs) {
    if (digits.length >= 9) return hasAccountWord || !looksLikePhone(digits) ? 'account' : 'phone';
  }
  if (hasAccountWord && runs.some((d) => d.length >= 6)) return 'account';
  return null;
}

export function findContactDetails(text: string | null | undefined): ContactDetailKind | null {
  if (!text) return null;
  const number = findNumber(numberWordsToDigits(text)) ?? findNumber(joinedNumberWordsToDigits(text));
  if (number) return number;
  if (EMAIL.test(text) || SPELLED_EMAIL.test(text) || MAIL_PROVIDERS.test(text)) return 'email';
  if (HANDLE.test(text) || SOCIAL_PLATFORMS.test(text)) return 'social';
  if (LINK.test(text)) return 'link';
  return null;
}

/** Hides most of what was shared ("024•••••67", "jo•••@gmail.com",
 * "@jo•••"), leaving enough for an admin to see what was tried. */
export function maskContactDetails(text: string): string {
  // Use the joined-up conversion only when that's what found the number,
  // so ordinary words stay readable in the flag.
  const strict = numberWordsToDigits(text);
  const base = findNumber(strict) || !findNumber(joinedNumberWordsToDigits(text)) ? strict : joinedNumberWordsToDigits(text);
  return base
    .replace(DIGIT_RUN, (run) => {
      const digits = run.replace(/\D/g, '');
      if (digits.length < 6) return run;
      return `${digits.slice(0, 3)}${'•'.repeat(Math.max(digits.length - 5, 1))}${digits.slice(-2)}`;
    })
    .replace(/([a-z0-9._%+-]{1,2})[a-z0-9._%+-]*@/gi, '$1•••@')
    .replace(/(^|[\s(:])@([a-z0-9_]{1,2})[a-z0-9_.]{2,}/gi, '$1@$2•••');
}

export const CONTACT_DETAILS_MESSAGE: Record<ContactDetailKind, string> = {
  phone: "Phone numbers can't be shared in chat. Keep the conversation here on Solid Connect.",
  account:
    "Bank and mobile money details can't be shared in chat. Every payment goes through Solid Connect, so you're both protected.",
  email: "Email addresses can't be shared in chat. Keep the conversation here on Solid Connect.",
  social:
    "Social media and messaging app details can't be shared in chat. Keep the conversation here on Solid Connect.",
  link: "Links can't be shared in chat. Send photos instead, or describe what you need here.",
};

export const CONTACT_DETAILS_TITLE: Record<ContactDetailKind, string> = {
  phone: 'Phone numbers not allowed',
  account: 'Account details not allowed',
  email: 'Email addresses not allowed',
  social: 'Social media not allowed',
  link: 'Links not allowed',
};
