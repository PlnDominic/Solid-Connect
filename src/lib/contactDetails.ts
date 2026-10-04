/**
 * Spots phone numbers and bank / mobile-money account details in a chat
 * message. Contact details stay off the chat so every booking and payment
 * goes through Solid Connect (and so nobody is pulled into an off-app
 * deal). Mirrored server-side by public.find_contact_details (0071), which
 * strips anything the app missed - keep the two rules in step.
 *
 * Rules:
 * - a run of digits (spaces, dashes, dots, brackets and a leading + allowed
 *   between them) holding 9+ digits - a phone number or an account number;
 * - an account/bank/MoMo keyword alongside a run of 6+ digits.
 * Commas and slashes break a run, so prices ("GHS 1,500") and dates
 * ("12/10/2026") pass.
 */
export type ContactDetailKind = 'phone' | 'account';

const DIGIT_RUN = /\+?\d[\d\s().-]*\d/g;
const ACCOUNT_WORDS = /\b(account|acct|a\/c|acc\s*no|momo|mobile\s*money|bank|iban|swift|sort\s*code)\b/i;

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
export function findContactDetails(text: string | null | undefined): ContactDetailKind | null {
  if (!text) return null;
  const runs = digitRuns(text);
  const hasAccountWord = ACCOUNT_WORDS.test(text);
  for (const digits of runs) {
    if (digits.length >= 9) return hasAccountWord || !looksLikePhone(digits) ? 'account' : 'phone';
  }
  if (hasAccountWord && runs.some((d) => d.length >= 6)) return 'account';
  return null;
}

/** "024 123 4567" -> "024•••••67": enough for an admin to see what was tried. */
export function maskContactDetails(text: string): string {
  return text.replace(DIGIT_RUN, (run) => {
    const digits = run.replace(/\D/g, '');
    if (digits.length < 6) return run;
    return `${digits.slice(0, 3)}${'•'.repeat(Math.max(digits.length - 5, 1))}${digits.slice(-2)}`;
  });
}

export const CONTACT_DETAILS_MESSAGE: Record<ContactDetailKind, string> = {
  phone: "Phone numbers can't be shared in chat. Keep the conversation here on Solid Connect.",
  account:
    "Bank and mobile money details can't be shared in chat. Every payment goes through Solid Connect, so you're both protected.",
};
