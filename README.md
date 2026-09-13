# Solid Connect

A two-sided service marketplace app for Accra, Ghana - customers post jobs
(plumbing, electrical, carpentry, etc.), verified providers quote and get
hired, and the job runs through chat, progress tracking, payment and a
rating, end to end. One account, switchable between customer and provider.

Built from a Claude Design clickable prototype (`Solid Connect App.dc.html`)
and a product/architecture brief, implemented as a real Expo (React Native)
app backed by a real Supabase project (Postgres + RLS + Realtime).

## Status

_Last updated 2026-09-13. Schema is at migration `0029`; this section is
kept in sync by hand, so if it looks stale, the migrations folder and git
log are the source of truth, not this file._

**Built and working:**

- Real Supabase email/password auth + Apple Sign-In (`src/lib/auth.ts`) -
  not anonymous/demo. One account, switchable between customer and
  provider roles.
- Full job lifecycle: post request → PostGIS-matched providers → quote →
  accept → chat → progress → completion → (simulated) payment → review.
- Staged provider verification (`REGISTERED` → `IDENTITY_VERIFIED` →
  `PROFESSION_VERIFIED` → `EXPERIENCE_VERIFIED` → `SOLID_CONNECT_VERIFIED`),
  with a real admin approve/reject workflow and a full audit trail.
- Live location sharing during an active job (`useReportJobLocation`,
  distance + "Open in Maps" on mobile, an ops map-equivalent table in
  admin) - foreground-only, deleted the moment a job completes.
- A full admin panel (`admin/`, Next.js): analytics + coverage-by-area,
  verifications (single and bulk), providers/customers/jobs/disputes/
  reviews with detail pages, live jobs, categories (with archive, not
  delete), team management with owner/support roles and an audit log,
  a broadcast composer, global search, CSV export, and a two-leg payments
  model (`payments` = customer → platform, `provider_payouts` = platform
  → provider, net of a configurable commission rate).
- Account suspension (admin-initiated, enforced at the next app-launch
  sign-in) and review moderation (hide/restore, with the provider's
  rating correctly recomputed either way).

**Explicitly still simulated / not real:**

- **Payments.** No live MoMo/card charging - `payments`/`provider_payouts`
  are real tables with real admin tooling, but nothing calls an actual
  payment gateway (Paystack/Flutterwave) yet. This is the actual blocker
  to the business model; everything else is built around it.
- **Push notifications.** No EAS project is linked, so a device can't get
  a push token; `notifications` rows are written (job events, admin
  broadcasts) but no mobile screen reads them yet.
- **Production deployment.** The Nest API only runs via `npm run start:dev`
  locally (no hosting target); there's no EAS build/submit configured for
  the App Store or Play Store.
- **Legal.** `LegalScreen.tsx` is honest placeholder copy, not documents
  reviewed by counsel.

See `docs/roadmap-and-risks.md` for the fuller gap list and sequencing.

## Stack

- **Mobile:** Expo (React Native + TypeScript) at repo root
- **Admin:** Next.js in `admin/`
- **API (Phase A+):** NestJS in `api/` — owns marketplace business rules
- **Data:** Supabase (Postgres, Auth, Storage, Realtime)
- **Queues (foundation):** Redis via `docker-compose.yml`

## Phase reports

- [Phase A acceptance](./docs/phase-a-acceptance.md) — NestJS foundation, health, JWT guard, CI
- [Phase B gap](./docs/phase-b-gap.md) / [acceptance](./docs/phase-b-acceptance.md) — users, roles, skills
- [Phase C gap](./docs/phase-c-gap.md) / [acceptance](./docs/phase-c-acceptance.md) — PostGIS areas, availability, geo search, verification levels
- [Phase D gap](./docs/phase-d-gap.md) / [acceptance](./docs/phase-d-acceptance.md) — requests, matching, provider opportunity feed
- [Phase E gap](./docs/phase-e-gap.md) / [acceptance](./docs/phase-e-acceptance.md) — quotes create/revise/accept → job
- [Phase F gap](./docs/phase-f-gap.md) / [acceptance](./docs/phase-f-acceptance.md) — jobs, events, chat, completion

> This phase-report trail stops at F (migration `0015`). Everything from
> `0016` onward - direct provider requests, live location, the entire
> admin panel, the two-leg payments model, category archiving - shipped
> without an equivalent gap/acceptance doc. For that work, the migration
> files' own comments and `git log` are the record; nothing has been
> backfilled into this format.

## Docs

- [`docs/`](./docs/README.md) - product, marketplace mechanics, system
  architecture, data model and roadmap, distilled from
  `assets/Solid_Connect_Project_Concept_and_System_Architecture.pdf`
  (includes a table of where this prototype currently diverges from that
  target architecture)
- [`PRODUCT.md`](./PRODUCT.md) - product record used by the design/redesign
  workflow (users, positioning, constraints)
- [`docs/legal/`](./docs/legal/README.md) - draft Terms of Service, Privacy
  Policy, Provider Agreement, and Refund & Dispute Policy. **Not reviewed
  by counsel, not wired into the app** - see that folder's README before
  using any of it.

## Getting started

### Mobile

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon/publishable key
npm start
```

### API

```bash
docker compose up -d redis   # optional; health reports degraded without it
cd api && cp .env.example .env && npm install && npm run start:dev
# http://localhost:3001/api/v1/health
# http://localhost:3001/docs
```

### Admin

```bash
cd admin && cp .env.example .env && npm install && npm run dev
```
