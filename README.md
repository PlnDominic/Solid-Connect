# Solid Connect

A two-sided service marketplace app for Accra, Ghana - customers post jobs
(plumbing, electrical, carpentry, etc.), verified providers quote and get
hired, and the job runs through chat, progress tracking, payment and a
rating, end to end. One account, switchable between customer and provider.

Built from a Claude Design clickable prototype (`Solid Connect App.dc.html`)
and a product/architecture brief, implemented as a real Expo (React Native)
app backed by a real Supabase project (Postgres + RLS + Realtime).

## Status

Work in progress. Scaffolded so far:

- Expo + TypeScript app shell (`App.tsx`, navigation/theme folders under `src/`)
- Design tokens (`src/theme`) matching the prototype's colors/type/radii
- Supabase client wiring (`src/lib/supabase.ts`) - anonymous auth, no OTP,
  matching the prototype's "Demo mode" login
- Full schema + RLS policies (`supabase/migrations/0001_init.sql`) and demo
  seed data (`supabase/seed/seed.sql`) for categories, sample providers and
  sample nearby requests
- Data layer (`src/api/*`) for profiles, categories/providers, requests +
  quotes, jobs + payments + reviews, and realtime chat

Still to come: onboarding/login screens, the customer and provider screen
flows, and wiring the Supabase project itself (URL/anon key go in `.env`,
see `.env.example`).

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

## Docs

- [`docs/`](./docs/README.md) - product, marketplace mechanics, system
  architecture, data model and roadmap, distilled from
  `assets/Solid_Connect_Project_Concept_and_System_Architecture.pdf`
  (includes a table of where this prototype currently diverges from that
  target architecture)
- [`PRODUCT.md`](./PRODUCT.md) - product record used by the design/redesign
  workflow (users, positioning, constraints)

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
