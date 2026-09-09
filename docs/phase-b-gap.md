# Phase B — Gap Report (Identity & Marketplace Foundation)

## EXISTING
- Supabase Auth (email/password, Google, Apple) — `src/lib/auth.ts`
- Single `profiles` row per account with switchable `role` — `0001_init.sql`
- Categories seed — `categories` + `supabase/seed/categories.sql`
- Provider fields on profile (category, rating, verified) — not separate provider_profiles
- NestJS JWT guard + `/auth/me` stub (always CUSTOMER) — Phase A

## PARTIAL
- Role switching works in UI but is a single active `profiles.role`, not multi-role `user_roles`
- Provider “skills” = free-text `provider_category` only
- Auth creates profile client-side; no application `users` table

## MISSING
- `users` / `roles` / `user_roles`
- `skills` / `provider_skills`
- NestJS endpoints for sync, become-provider, switch active role, list skills
- Server-side role resolution for `/auth/me`

## CONFLICTING
- Spec: one account, multiple roles via `user_roles`
- Current: mutually exclusive `customer|provider` on `profiles.role`
- Resolution: add `user_roles` (multi) + keep `profiles.role` as **active mode** for backwards-compatible mobile UX

## Plan
1. Migration `0011_identity_roles_skills.sql` + backfill
2. NestJS users/auth/categories/skills/providers modules (Supabase service client)
3. Mobile: call API sync + become-provider/switch alongside existing profile updates
4. Tests + acceptance report
