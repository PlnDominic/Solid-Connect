# Marketplace Mechanics

Source: §7–11 of the concept document.

## Request/matching model

Recommended model is **hybrid**: customers can search providers directly,
or submit a structured service request and let Solid Connect identify
suitable providers.

| Model | Description | Recommendation |
|---|---|---|
| Direct search | Customer searches and browses providers | MVP |
| Service request | Customer describes a need and providers are matched | Core MVP |
| Quotation / bidding | Providers respond with prices and proposals | Core feature |
| Negotiation | Customer and provider agree details through controlled communication | Core feature |
| Recurring service | Customer creates recurring arrangements | Phase 2 |

```
SERVICE REQUEST
      |
      +-- Quote A
      +-- Quote B
      +-- Quote C
             |
             v
       Accepted Quote
             |
             v
            JOB
             |
       +-----+-----+
       |     |     |
     Chat  Payment Review
```

> The current prototype already implements this shape: `service_requests`
> → `quotes` → accepted quote creates a `job` → chat/payment/review follow
> (see `src/api/requests.ts`, `src/api/jobs.ts`).

## Provider matching and GIS

Matching should be a core capability. Candidate providers ranked using
skill, distance, availability, verification, rating, experience, response
history and price suitability.

| Factor | Illustrative weight |
|---|---|
| Skill match | 30% |
| Distance | 20% |
| Availability | 15% |
| Rating | 10% |
| Experience | 10% |
| Verification | 5% |
| Price suitability | 5% |
| Response history | 5% |

> Weights are illustrative - validate against real marketplace data before
> encoding them anywhere.

```
Customer GPS -> NestJS API -> PostGIS spatial query
  -> Providers within service radius
  -> Filter by skill, availability and verification
  -> Rank candidates -> Return matches
```

PostGIS can support provider discovery, distance calculations, service
areas, demand analysis and future marketplace intelligence.

> **Gap:** no matching algorithm exists yet. `useTopProviders` /
> `useAllProviders` (`src/api/marketplace.ts`) just sort by
> `provider_rating` - no distance/skill/availability weighting, no PostGIS.

## Trust, verification and reputation

Trust is a core pillar. Provider profiles should communicate identity,
qualifications, experience, portfolio, completed jobs and reputation.

### Verification levels

| Level | Purpose |
|---|---|
| Registered | Provider has created an account |
| Identity verified | Identity information has been reviewed |
| Profession verified | Relevant qualifications/professional information verified where applicable |
| Experience verified | Employment, references or work history reviewed where applicable |
| Solid Connect verified / certified | Higher-level verification or assessment under a defined Solid Connect standard |

> **Gap:** the schema currently has a single `provider_verified` boolean
> plus `provider_certified` (`BadgeKind = 'certified' | 'verified'` in
> `src/types/database.ts`) - a two-state simplification of this five-level
> model. The redesigned UI's "verified" badge/stamp treats this as a single
> boolean; if the five-level model gets built out, the badge will need a
> level-aware variant.

### Reputation signals

- Overall rating
- Quality of work
- Professionalism
- Communication
- Punctuality
- Value for money
- Completed jobs
- Cancellation and response history

## Payments and commercial transactions

Payment architecture should be **modular** so Solid Connect can support
multiple payment methods/providers. For Ghana, mobile money and card
payments are important.

```
Customer -> Payment gateway -> Solid Connect transaction
     -> Platform commission
     -> Provider payout
     -> Refund / dispute process where applicable
```

An escrow-style model may be considered for suitable jobs, subject to the
selected payment provider, business rules and legal requirements.

> **Gap:** no real payment integration exists. `types/database.ts` has a
> `Payment` shape (`PaymentStatus = 'pending' | 'released' | 'refunded'`)
> but nothing wires it to an actual gateway (mobile money/card) yet. The
> onboarding/home redesign's "MoMo confirmation language" direction was
> chosen specifically because mobile money is the payment method this
> document flags as important for Ghana - worth keeping in mind once real
> payment integration is scoped.

## Disputes, safety and marketplace protection

```
Complaint -> Evidence submitted -> Solid Connect review -> Decision
    + Provider paid
    + Partial refund
    + Full refund
    + Warning / suspension
    + Further investigation
```

- Allow users to report providers and customers.
- Maintain auditable job and payment events.
- Base verified reviews on completed platform jobs.
- Introduce controls against fake accounts, spam and payment abuse.

> **Gap:** no dispute/reporting flow exists in the current app yet.
