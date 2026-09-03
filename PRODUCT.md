# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

<!-- Expo/React Native, one shared codebase and design language for iOS and Android (not OS-adaptive). Tuned to iOS conventions as the reference point (per user); renders on Android without a separate Material-driven variant. -->

## Users

Two-sided marketplace, one account switchable between roles:

- **Customers** in Accra, Ghana who need a home-services job done (plumbing, electrical, carpentry, cleaning, and similar categories) and want to post it and get a verified pro quickly, without relying on a personal contact or an unvetted Jiji/Facebook Marketplace listing.
- **Providers** (plumbers, electricians, artisans, cleaners) who are verified on the platform, browse/receive job requests, quote, get hired, and get paid through the app.

## Product Purpose

Solid Connect lets a customer post a home-services job and get matched with a verified provider, then run the whole job lifecycle - quoting, chat, progress tracking, payment, and rating - inside the app, end to end. Success is a completed, paid, rated job with both sides trusting the process enough to come back for the next one.

## Positioning

Verification & accountability is the core, non-copyable proof point: providers are vetted and tied to a persistent identity, so ratings and job history are real and accumulate - unlike a phone-contact referral or an open listing (Jiji/Facebook Marketplace/word of mouth) where there is no accountability trail and no recourse. The premium redesign should make this trust mechanism visible and legible (verification badges, real rating/job-history surfaces, transparent status through the job), not just claim it in copy.

## Operating Context

- Built from a Claude Design clickable prototype (`Solid Connect App.dc.html`, not present in this checkout) plus a product/architecture brief; the current implementation is the incumbent visual system, evidence and anti-reference for the redesign, not an authority to preserve.
- Backed by a real Supabase project (Postgres + RLS + Realtime); auth is currently anonymous/"Demo mode" (no OTP yet).
- Full schema, RLS policies, and demo seed data exist for categories, sample providers, and sample nearby requests (`supabase/migrations`, `supabase/seed`) - current screens run against this seed data, not real production content.
- Screen inventory (current): onboarding (splash, onboarding slides, login, auth flow), customer (home, all providers, job detail, jobs, matching, new request, profile, requests), provider (feed, job detail, jobs, payout details, profile, request detail, service areas), shared (chat list, chat thread, help/support, notifications, payment methods).
- Job lifecycle spans: post request → matching/quotes → chat → progress tracking → payment → rating.

## Capabilities and Constraints

- Stack: Expo (React Native + TypeScript), React Navigation, Zustand, TanStack Query, Supabase (Postgres, Auth, Realtime).
- Design tokens currently live in `src/theme/index.ts` (colors, radii, spacing, fonts - Plus Jakarta Sans, shadow presets); shared primitives in `src/components/*` (Avatar, Badge, BottomSheet, Button, CategoryTile, EmptyState, Screen, ScreenHeader, StepDots).
- No real production content, testimonials, pricing data, or provider photography exists yet - only seed/demo data. Redesign work must not fabricate real testimonials, benchmarks, or pricing claims; realistic-but-labeled placeholder content is fine.
- No PRODUCT.md/DESIGN.md existed before this session; the incumbent code/theme is the only prior design authority, and is being explicitly replaced (redesign, not refinement) per user request.

## Brand Commitments

None confirmed as binding yet - app name "Solid Connect" is the only fixed brand fact. No locked palette, wordmark, or typeface beyond what the incumbent implementation already uses (open to replacement in the redesign).

## Evidence on Hand

- `src/theme/index.ts` - current design tokens (colors, radii, spacing, fonts, shadows).
- `src/screens/**`, `src/components/**` - current screen and component implementations (incumbent visual system; anti-reference for the redesign per user's replace-the-look direction).
- `supabase/migrations/0001_init.sql`, `supabase/seed/seed.sql` - real schema and demo seed data (categories, sample providers, sample requests) to design real states around.
- No real photography, logos beyond `assets/icon.png`/adaptive icon set, testimonials, or pricing evidence exists. Do not fabricate these; use clearly-placeholder content where the design needs it.

## Product Principles

1. Trust is the product: verification and accountability must read visually, not just be claimed in copy - badges, real rating/job-history surfaces, transparent job status.
2. One codebase, one design language: iOS is the tuning reference, but nothing should look broken or foreign on Android - no OS-specific fork of the system.
3. Two audiences, one system: customer and provider flows share the same design system and quality bar; the redesign starts with shared foundations (tokens + core components) before extending screen by screen.
4. Design for the real job lifecycle (post → match → quote → chat → track → pay → rate), not just isolated screens - the premium feel has to survive the full flow, including empty/loading/error states against real seed data shapes.
5. Never let "premium" become generic-luxury: the app serves working customers and tradespeople in Accra getting a practical job done - premium means precise, fast, and trustworthy, not ornamental.

## Accessibility & Inclusion

No specific standard confirmed. Given the practical, task-focused user base (customers under time pressure, providers possibly on-site with poor lighting/connectivity), treat solid contrast, large tappable targets, and resilience to slow/flaky network as baseline expectations even though no formal requirement was stated.
