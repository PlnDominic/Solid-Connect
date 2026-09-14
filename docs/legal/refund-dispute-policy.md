# Solid Connect — Refund & Dispute Policy

**DRAFT — not reviewed by counsel. See `README.md` in this folder before
using this document for anything.** This document describes mechanics that
exist today in the admin panel (`admin/app/(protected)/disputes`,
`payments`, `payouts`) applied to a payment flow that is not yet live (see
Section 1) — read it as the intended policy, not a description of money
that has actually moved.

_Last drafted: 2026-09-13._

## 1. How payment escrow works (once live)

When a customer accepts a provider's quote, the agreed price is **held by
Solid Connect**, not paid to the provider yet. It stays held while the job
is in progress. When the customer confirms the job complete, Solid Connect
releases the held amount to the provider, minus commission.

**As of this draft, this is not yet connected to a real payment
gateway** — no real money is charged or held today. This policy describes
what happens once it is.

## 2. Opening a dispute

If something is wrong with a job — instead of confirming it complete — a
customer can open a dispute from that job in the App, choosing a reason:

- **Not completed** — the provider didn't finish, or didn't show up to
  finish, the agreed work.
- **Poor quality** — the work was completed but doesn't meet a reasonable
  standard for what was agreed.
- **Overcharged** — the amount doesn't match what was agreed.
- **No-show** — the provider never arrived.
- **Other** — anything not covered above, described in your own words.

A dispute needs a description of what happened. You must open a dispute
within **48 hours of the job being marked complete** — the App enforces
this window; past it, the dispute screen shows that filing has closed
and points you to support instead. A job that hasn't been marked
complete yet has no window - you can still dispute a no-show or an
in-progress problem.

## 3. What happens after you open one

- The payment tied to that job stays held (not released to the provider)
  while the dispute is open.
- Solid Connect's admin team reviews the evidence available on the job:
  the full status timeline, the chat transcript between you and the
  provider, and any photos attached to the original request.
- The admin team resolves the dispute with a written explanation of the
  outcome, and — where warranted — refunds the held payment back to you
  instead of releasing it to the provider.
- If the payment had already been released and paid out to the provider
  before the dispute was raised, a refund at that point is a direct
  conversation between Solid Connect and the provider, not an automatic
  reversal — see `provider-agreement.md` Section 6.

## 4. What a resolution looks like

Every dispute resolution includes a plain-language note explaining the
outcome — not just "approved" or "denied". You can see this note in the
App once your dispute is resolved. Possible outcomes:

- **Refunded**: the held payment is returned to you.
- **Released to provider**: the admin team found the work was
  satisfactorily completed as agreed; the payment is released normally.
- **Partial refund**: part of the held payment is returned to you, and
  the provider is still paid the remainder - used when the work was
  partly done, or partly met what was agreed.

## 5. If you disagree with a resolution

Contact **support@solidconnect.co** with your job reference and the reason
you believe the resolution was wrong. This is a manual escalation, not an
automated re-dispute — Solid Connect does not currently have a formal
appeals process beyond direct support contact.

## 6. Cancelling before a job starts

_[Placeholder — this policy currently covers disputes on an already-
accepted job. A separate policy for cancelling a request before a provider
is matched, or cancelling an accepted-but-not-yet-started job, needs to be
written; check `docs/marketplace-mechanics.md` for whether that flow
already has agreed rules that just need restating here.]_

## 7. Provider no-shows and repeated issues

A pattern of no-show or poor-quality disputes against the same provider is
also a conduct matter under `provider-agreement.md` Section 8, separate
from the refund itself — Solid Connect may suspend a provider's account
independent of any individual dispute's resolution.
