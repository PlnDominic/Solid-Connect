# Phase B — Acceptance Report

Date: 2026-09-09  
Scope: Identity, roles, categories/skills foundation (master-spec Phase B)

## Gap report

See [phase-b-gap.md](./phase-b-gap.md).

## Implemented

| Deliverable | Location |
|---|---|
| Migration users / roles / user_roles / skills / provider_skills + backfill | `supabase/migrations/0011_identity_roles_skills.sql` |
| NestJS Supabase admin client | `api/src/supabase/*` |
| UsersService ensure/grant/become/switch/skills | `api/src/users/users.service.ts` |
| Auth: me, sync, become-provider, switch-role | `api/src/auth/auth.controller.ts` |
| JWT guard loads roles from DB | `api/src/auth/guards/supabase-jwt.guard.ts` |
| Categories + skills list | `GET /api/v1/categories`, `GET /api/v1/skills` |
| Provider skills read/write | `api/src/providers/providers.controller.ts` |
| Mobile API client + identity helpers | `src/lib/api.ts`, `src/api/identity.ts` |
| Profile create/switch calls API when configured | `src/api/profile.ts` |
| `EXPO_PUBLIC_API_URL` | `.env` / `.env.example` |

## Exit scenario mapping

| Step | Support |
|---|---|
| Kwame registers | Existing Expo auth + `POST /auth/sync` after profile upsert |
| Starts as customer | `CUSTOMER` role granted on sync; `profiles.role = customer` |
| Become a provider | `POST /auth/become-provider` grants `PROVIDER` + sets active role |
| Adds plumbing skills | `PUT /providers/me/skills` + skills seeded per category |
| Same account both modes | `user_roles` holds both; `profiles.role` is active mode; `POST /auth/switch-role` |

## Tests / build

Run in `api/`: `npm test` && `npm run build`

## Apply migration (required)

Remote DB still needs SQL apply (no `DATABASE_URL` in repo):

1. Supabase Dashboard → SQL Editor  
2. Run `supabase/migrations/0011_identity_roles_skills.sql`  
   (also included at end of `supabase/apply-pending.sql`)

Until applied, `/auth/me` falls back to `CUSTOMER` if `users` table is missing.

## Not in Phase B

- Full NestJS register/OTP (still Supabase Auth)
- Separate `customer_profiles` / `provider_profiles` tables (still using `profiles`)
- Skill hierarchy admin UI
- Moving quote/job rules off mobile (Phase E/F)

## Next

**Phase C — Trust and location:** verification levels, service areas (PostGIS), availability, portfolio hardening, provider search.
