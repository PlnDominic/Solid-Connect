# Solid Connect — Privacy Policy

**DRAFT — not reviewed by counsel. See `README.md` in this folder before
using this document for anything, especially regarding Ghana's Data
Protection Act, 2012 (Act 843) and Data Protection Commission
registration.**

_Last drafted: 2026-09-13._

## 1. What this covers

This policy describes what personal data Solid Connect collects through the
App, why, how long we keep it, and how you can request it be deleted. It
applies to both customer and provider accounts.

## 2. What we collect

**Account information** (both roles): full name, initials/avatar, phone
number, email address, area/neighborhood, and a profile photo if you add
one.

**Provider-specific information**: your trade category or categories, a
tagline/bio, portfolio photos of past work, service areas, and availability
status.

**Verification documents** (providers only): government ID and other
documents you submit to be verified, stored in a private storage location
only you and Solid Connect's admin team can access — never shown publicly.

**Job content**: the request you post (description, category, photos you
attach, budget), quotes exchanged, and the resulting job's details (title,
price, location label, status, timestamps).

**Chat messages**: messages exchanged with the other party on a job, tied
to that job's chat thread.

**Live location — while a job is active only**: if you grant permission,
your device's foreground location is shared with the other party on that
specific job (so a customer can see their provider en route, or vice
versa). This:

- Is **never** collected in the background — only while the app is open and
  the job is in an active status.
- Is **deleted automatically the moment the job is marked complete** — we
  do not keep a location history.
- Is visible only to the other party on that job and to Solid Connect's
  admin team (for support/dispute purposes), never publicly.

**Reviews**: the star rating and any written comment you leave, tied to
your name and the job.

**Notifications**: in-app messages we send you about job updates, quotes,
and (if you opt in) product announcements.

**Payment information**: once real payment processing is connected (see
`terms-of-service.md` Section 7), the amount, status, and timing of
payments and payouts tied to your jobs. We do not store your card or mobile
money credentials ourselves — that will be handled by our payment
processor once one is integrated.

**Usage and device information**: a push-notification token if you enable
notifications, and standard technical data (device type, app version)
needed to make the app work reliably.

## 3. What we don't do

- We do not sell your personal data.
- We do not show your phone number or email to other users; they see your
  name, initials/photo, area, and (for providers) trade/rating/reviews.
- We do not use your live location for anything other than showing it to
  the other party on an active job, as described above.

## 4. Who can see what

| Data | Visible to |
|---|---|
| Name, photo, area, rating, reviews | Any user browsing the marketplace |
| Phone, email | Only Solid Connect (used for account recovery and, where a job connects two parties, may be shared between them for coordinating the job) |
| Verification documents | Only you and Solid Connect's admin/verification team |
| Live job location | Only the other party on that specific job, and Solid Connect's admin team |
| Chat messages | Only the two parties on that thread, and Solid Connect's admin team (for disputes/support) |
| Payment/payout details | You, and Solid Connect's admin/finance team |

## 5. How long we keep it

- **Live location**: deleted immediately on job completion (see Section 2).
- **Verification documents**: kept for as long as your account is verified
  or under review, and for a reasonable period after in case a dispute or
  regulatory question arises about that verification.
- **Job, chat, review, and payment records**: kept for the life of your
  account, since they form the accountability history the whole trust model
  depends on (a provider's rating and job history need to persist to mean
  anything).
- **Account information**: kept until you request deletion (Section 6) or
  your account is removed for a Terms violation.

## 6. Your rights and deleting your account

You can request account deletion by contacting **support@solidconnect.co**.
When you do:

- Your account information, verification documents, and any personally
  identifying profile details are removed.
- Job, payment, and dispute records tied to jobs with **other** users may
  be retained in an anonymized or minimally-identifying form, since those
  other users' own accountability history depends on the job having
  happened — this mirrors how the provider rating/job-count system works
  today (removing a review recalculates the aggregate rather than just
  disappearing).

_[Placeholder — the exact mechanics of "anonymized retention" above need to
be defined precisely and checked against Act 843's data-subject rights
before this policy is finalized; this draft states the intent, not a
guaranteed technical implementation.]_

## 7. Data storage and security

Your data is stored in Supabase (Postgres), a third-party infrastructure
provider, with row-level security policies restricting who can read what —
for example, only you and an admin can read your verification documents;
only the two parties on a job (and admins) can read that job's live
location or chat.

_[Placeholder — needs a statement on where Supabase's servers are located
(data residency), whether that satisfies Act 843's cross-border transfer
requirements if data leaves Ghana, and Solid Connect's Data Protection
Commission registration status.]_

## 8. Children

The App is not intended for anyone under 18. We do not knowingly collect
data from children.

## 9. Changes to this policy

We may update this policy as the App changes. We'll make a reasonable
effort to notify you of material changes before they take effect.

## 10. Contact

Questions about this policy or your data: **support@solidconnect.co**.

_[Placeholder — Act 843 may require a named Data Protection Officer and
their contact details, and formal registration with the Data Protection
Commission before this app processes personal data at any real scale.]_
