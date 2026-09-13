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
export const LEGAL_VERSION = '2026-09-13';

export const LEGAL_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Terms of service',
    body: 'Solid Connect connects customers in Accra with verified service providers. By using the app you agree to post accurate job details, keep communication on-platform where possible, and treat the other party with respect. Quotes and job confirmations create a binding engagement between customer and provider; Solid Connect facilitates matching, chat, and (when live) payment rails but is not the employer of providers.',
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
