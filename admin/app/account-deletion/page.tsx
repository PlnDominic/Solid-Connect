import '../legal/legal.css';

export const metadata = { title: 'Delete your account · Solid Connect' };

const SUPPORT_EMAIL = 'cosolid93@gmail.com';

/** Public page for the Google Play account-deletion link. Readable signed out
 * (see the proxy matcher) and not tied to LEGAL_PAGES_PUBLISHED. Keep the lists
 * in step with anonymize_profile and lib/accountDeletion.ts. */
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
          email, area, tagline, service category, notification settings and map location. We also delete your profile
          photos, portfolio photos and videos, and ID or verification documents.
        </p>

        <h2>What is kept</h2>
        <p>
          Records shared with other people, such as jobs, reviews, disputes and chat messages, are kept so their history
          stays accurate. They no longer show your profile name. Text or photos you put in them may still identify you.
        </p>
        <p>
          Photos and voice notes you sent in requests, job posts, chats and disputes are also kept, because the other
          person or a dispute may need them.
        </p>
      </article>
    </main>
  );
}
