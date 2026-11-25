import '../legal/legal.css';

export const metadata = { title: 'Delete your account · Solid Connect' };

const SUPPORT_EMAIL = 'support@solidconnect.co';

/** Public page for the Google Play account-deletion link. Readable signed out
 * (see the proxy matcher) and not tied to LEGAL_PAGES_PUBLISHED. Keep the lists
 * in step with anonymize_profile and the deletion-requests action. */
export default function AccountDeletionPage() {
  return (
    <main className="legal-page">
      <article className="legal-doc">
        <h1>Delete your Solid Connect account</h1>

        <h2>Ask by email</h2>
        <p>
          You do not need the app. Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20Solid%20Connect%20account`}>{SUPPORT_EMAIL}</a> from
          the email address on your account, with the subject &quot;Delete my Solid Connect account&quot;. We may ask
          you to confirm that the account is yours. Never send us your password.
        </p>

        <h2>Or ask in the app</h2>
        <p>Open Profile, then Account security, choose Delete my account, then Request account deletion.</p>

        <h2>What is removed</h2>
        <p>
          Our team processes each request. We remove your sign-in, and remove from your profile your name, phone number,
          email, area, profile photo link, tagline, service category and notification settings.
        </p>

        <h2>What is kept</h2>
        <p>
          Records shared with other people, such as jobs, reviews, disputes and chat messages, are kept so their history
          stays accurate. They no longer show your profile name. Text or photos you put in them may still identify you.
        </p>
        <p>
          Uploaded photos and ID documents are not removed automatically. To ask for them to be deleted, say so in your
          email.
        </p>
      </article>
    </main>
  );
}
