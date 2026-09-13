# Legal documents — draft, not reviewed by counsel

**These four documents are drafts written by an AI assistant (Claude), grounded
in what's actually built in this codebase as of 2026-09-13. They are not legal
advice, and Solid Connect must not rely on them, publish them, or link them
from the live app until a lawyer qualified in Ghanaian law has reviewed and
approved them.** That review should specifically cover:

- **Data Protection Act, 2012 (Act 843)** and Ghana Data Protection
  Commission registration/compliance requirements for a platform storing
  names, phone numbers, addresses, verification documents, and (while a job
  is active) live location.
- **Bank of Ghana payment service provider rules** — relevant the moment a
  real MoMo/card gateway is connected (see `docs/roadmap-and-risks.md`); a
  marketplace holding customer funds in escrow before releasing them to a
  provider may have specific licensing or partnership requirements.
- **Consumer protection law** applicable to services (not goods) marketplaces
  in Ghana.
- Whether Solid Connect should be structured as an **agent/facilitator** or
  something else for liability purposes — the drafts below assume "agent",
  matching `LegalScreen.tsx`'s existing framing ("facilitates matching, chat,
  and (when live) payment... is not the employer of providers").
- **Professional licensing** for regulated trades (electrical work in
  particular often has statutory licensing requirements) — `verification.md`
  below flags this but doesn't resolve it.

## What's here

- [`terms-of-service.md`](./terms-of-service.md) — the umbrella agreement for
  anyone using the app, either role.
- [`privacy-policy.md`](./privacy-policy.md) — what's collected, why, how
  long it's kept, and how to request deletion.
- [`provider-agreement.md`](./provider-agreement.md) — terms specific to
  providers: verification, commission, payout, conduct, suspension.
- [`refund-dispute-policy.md`](./refund-dispute-policy.md) — the customer-
  facing version of the escrow/dispute mechanics the admin panel already
  implements (`admin/app/(protected)/disputes`, `payments`, `payouts`).

## What's grounded vs. what's a placeholder

Every concrete mechanic named in these drafts (verification levels, the
escrow flow, commission, dispute resolution windows, suspension) matches
something real in the schema and admin tooling as of migration `0029` — I
did not invent workflow steps to sound formal. Two things are explicitly
**not** grounded and need a business decision before these documents can be
finalized:

1. **The commission rate.** The drafts say "the commission rate shown in the
   app" rather than a fixed number, since it's admin-configurable
   (`platform_config.commission_percent`, currently 15%) and could change.
2. **The dispute filing window.** `disputes` has no time-limit column
   enforcing one — the drafts propose 48 hours after job completion as a
   placeholder figure (matching a note already in `PaymentMethodsScreen.tsx`)
   but this is not enforced anywhere in code and needs a decision.
