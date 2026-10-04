/**
 * Shared source for the in-app Terms & Privacy summary shown on
 * `LegalScreen` and in the sign-up consent sheet (`SignUpScreen`) - one
 * copy of the wording so the two surfaces can't drift apart.
 *
 * This is a short in-app summary, not the drafted long-form documents in
 * `docs/legal/` (Terms of Service, Privacy Policy, Provider Agreement,
 * Refund & Dispute Policy) - those are markdown files reviewed by no one
 * yet and not shipped in the app. `LEGAL_VERSION` tracks this summary's
 * own last-edited date, recorded on `profiles.terms_version` at sign-up
 * so a future rewrite can tell who agreed to which wording.
 */
export const LEGAL_VERSION = '2026-10-04';

export const LEGAL_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Terms of service',
    body: 'Solid Connect connects customers in Accra with service providers, and marks the ones Solid Connect has verified. You must be 18 or older to create an account. By using the app you agree to post accurate job details, keep communication on-platform where possible, and treat the other party with respect. Quotes and job confirmations create a binding engagement between customer and provider; Solid Connect facilitates matching, chat, and (when live) payment rails but is not the employer of providers.',
  },
  {
    title: 'Privacy',
    body: 'We store your profile, job history, chat messages, and verification documents to run the marketplace. Photos you upload (profile, portfolio, request attachments, verification) are stored in Supabase Storage under access rules that match their purpose. We do not sell personal data. You can request account deletion from Settings, or by contacting support.',
  },
  {
    title: 'Payments & disputes',
    body: 'Until live mobile-money / card rails ship, payment screens are simulated. When live payments land, releasing payment after job confirmation moves funds per the agreed quote, subject to platform commission. Open a dispute from a job within the window shown on that screen if work was incomplete, poor quality, overcharged, or a no-show.',
  },
];

/**
 * Where the full documents are published (the admin site's public /legal
 * pages), e.g. https://admin.solidconnectltd.com/legal. Unset until counsel
 * has approved docs/legal - and while it's unset the app shows no links to
 * them, only the summary above.
 */
const LEGAL_BASE_URL = (process.env.EXPO_PUBLIC_LEGAL_URL ?? '').replace(/\/+$/, '');

export const LEGAL_DOCS = [
  { slug: 'terms', title: 'Terms of Service' },
  { slug: 'privacy', title: 'Privacy Policy' },
  { slug: 'refunds', title: 'Refund & Dispute Policy' },
  { slug: 'providers', title: 'Provider Agreement' },
] as const;

export type LegalDocSlug = (typeof LEGAL_DOCS)[number]['slug'];

/** The full document's public URL, or null while the documents aren't published. */
export function legalDocUrl(slug: LegalDocSlug): string | null {
  return LEGAL_BASE_URL ? `${LEGAL_BASE_URL}/${slug}` : null;
}
