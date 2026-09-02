# Solid Connect

A two-sided service marketplace app for Accra, Ghana — customers post jobs
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
- Supabase client wiring (`src/lib/supabase.ts`) — anonymous auth, no OTP,
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

Expo (React Native + TypeScript), React Navigation, Zustand, TanStack Query,
Supabase (Postgres, Auth, Realtime).

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm start
```
