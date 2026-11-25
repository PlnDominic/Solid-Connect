# Solid Connect — Privacy Policy

**DRAFT — not reviewed by counsel. See `README.md` in this folder before
using this document for anything, especially regarding Ghana's Data
Protection Act, 2012 (Act 843) and Data Protection Commission
registration.**

_Last drafted: 2026-11-25._

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

**Approximate location on the map — providers**: while your status is
"Available now" and the app is open, your position is rounded to a grid of
about 450 metres and shown to signed-in users on the map. Only the latest
rounded position is stored. It stops showing about 10 minutes after the last
update, and is removed when you change your status in the app or your account
is deleted. It can stay stored, without being shown, if you simply close the
app.

**Safety alerts and reports**: if you send a safety alert, we store your
note and, if available, your location at that moment. If you report a user,
we store the report.

**App error reports**: when the app hits an error, we store the error
message and technical trace, the screen, app version, phone platform and, if
you are signed in, your account ID, so we can fix it.

**Reviews**: the star rating and any written comment you leave, tied to
your name and the job.

**Notifications**: in-app messages we send you about job updates, quotes,
and (if you opt in) product announcements.

**Subscription payments (providers)**: if you are a provider, the amount,
status and timing of your subscription payments. We do not store your card
or mobile money credentials ourselves; that is handled by our payment
processor. Job payments are made directly between customer and provider and
never pass through Solid Connect, so we hold no record of them.

**Usage and device information**: a push-notification token if you enable
notifications, and standard technical data (device type, app version)
needed to make the app work reliably.

## 3. What we don't do

- We do not sell your personal data.
- We do not show your email to other users. We show your phone number only to
  the other person on your job while that job is active. Otherwise they see
  your name, initials/photo, area, and (for providers) trade/rating/reviews.
- We do not use your location for anything other than the purposes described
  in Section 2.
- We do not allow phone numbers or payment account details in chat messages.
  The app blocks or removes them and records the attempt for our team to
  review.

## 4. Who can see what

| Data | Visible to |
|---|---|
| Name, photo, area, rating, reviews | Any user browsing the marketplace |
| Email | Only you and Solid Connect's admin team |
| Phone | You, Solid Connect's admin team, and the other person on your job while it is active |
| Approximate map location (providers who are "Available now") | Signed-in users viewing the map |
| Verification documents | Only you and Solid Connect's admin/verification team |
| Live job location | Only the other party on that specific job, and Solid Connect's admin team |
| Chat messages | Only the two parties on that thread, and Solid Connect's admin team (for disputes/support) |
| Subscription payment records (providers) | You, and Solid Connect's admin/finance team |

## 5. How long we keep it

- **Live location**: deleted immediately on job completion (see Section 2).
- **Verification documents**: kept while your account is open, and deleted
  when we complete the deletion of your account. Documents from a rejected
  submission are due for removal 90 days after the rejection.
- **Job, chat, review, and subscription records**: kept for the life of your
  account, since they form the accountability history the whole trust model
  depends on (a provider's rating and job history need to persist to mean
  anything).
- **Account information**: kept until you request deletion (Section 6) or
  your account is removed for a Terms violation.

## 6. Your rights and deleting your account

You can ask us to delete your account in the app (Profile, then Account
security) or by emailing **cosolid93@gmail.com** from your account's email
address. Our team processes each request. We may ask you to confirm that the
account is yours.

**What we delete:** your sign-in; your name, phone number, email, area,
tagline, service category, notification settings and map location; your
profile photos, portfolio photos and videos; and your ID and verification
documents.

**What we keep:** records shared with other people or needed to settle a
dispute, such as requests, job posts, quotes, jobs, reviews, chats, reports
and disputes, including the text, locations, photos and voice notes in them,
as well as subscription, safety and administration records. These no longer
show your profile name, but what you wrote or attached in them may still
identify you.

_[Placeholder — counsel must confirm that keeping these records, and for how
long, complies with Act 843's data-subject rights. No time limit is applied
to them today.]_

## 7. Data storage and security

Your data is stored in Supabase (Postgres), a third-party infrastructure
provider, with row-level security policies restricting who can read what —
for example, only you and an admin can read your verification documents;
only the two parties on a job (and admins) can read that job's live
location or chat.

**Outside services the App uses.** Only these services receive data from
your device, and only for the purpose listed:

| Service | What it receives | Why |
|---|---|---|
| Supabase | Everything described in Section 2 | Hosts our database, file storage and sign-in |
| OpenStreetMap tile servers | Your device's IP address and the part of the map on screen (not your name or account) | Draws the map images on the Map tab and the live-job map. The map code itself is built into the App, so no other site is contacted to show a map |
| Expo push service (with Apple or Google) | Your push-notification token and the notification text | Delivers notifications, only if you turn them on |
| Google or Apple sign-in | Your name and email, from them to us | Only if you choose to sign in that way |
| Hubtel | Your subscription payment amount and mobile-money or card details (providers only) | Processes the provider subscription |

The App does not use advertising trackers, analytics tools, or session
recording, and does not load fonts or scripts from other websites.

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

Questions about this policy or your data: **cosolid93@gmail.com**.

_[Placeholder — Act 843 may require a named Data Protection Officer and
their contact details, and formal registration with the Data Protection
Commission before this app processes personal data at any real scale.]_
