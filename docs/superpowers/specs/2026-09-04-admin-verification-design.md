# Admin Dashboard — Foundation + Provider Verification

Status: approved for planning
Date: 2026-09-04

## Context

Solid Connect currently has no admin concept anywhere: no admin role, no
admin screens, no admin auth, no admin database tables. The mobile app
(`src/`) is Expo/React Native for customers and providers only, running
against a Supabase project with anonymous auth and broad-read RLS
(`supabase/migrations/0001_init.sql`). `profiles.provider_verified` and
`provider_certified` exist as bare booleans with no submission or review
process behind them.

The longer-term concept doc (`docs/system-architecture.md`,
`docs/product-overview.md`, `docs/roadmap-and-risks.md`) already
anticipates a Next.js admin web portal with users/verification/disputes/
payments/categories/analytics, RBAC, MFA, and audit logs on
administrative and verification events — as a target architecture behind
a versioned REST API layer. This spec builds the lean-MVP-consistent
slice of that vision: no separate API/service layer (the mobile app
already talks to Supabase directly, and the admin app will too), no
MFA/RBAC-with-multiple-roles yet — just a working admin login and a real
provider-verification queue, on the same direct-to-Supabase pattern the
rest of the app uses. Later sub-projects (disputes, analytics, catalog
management, RBAC/MFA/audit-log hardening) build on this foundation
without re-architecting it.

The admin dashboard is a **new web app**, not new screens inside the
Expo app — admin work (reviewing documents, working a queue) is a
desk/keyboard task, and the existing mobile app has no web-appropriate
layout primitives (tables, dense lists) to build that on.

## Scope

This sub-project covers:

1. A new Next.js admin web app (foundation: scaffold, auth, nav shell).
2. Database schema for real provider verification (submissions,
   documents, review state) — replacing the bare boolean.
3. The provider-verification queue and review screens in the admin app.
4. One new mobile screen so providers can actually submit for
   verification (there is currently no way to).

Out of scope (future sub-projects, not designed here): dispute/job
oversight, platform analytics, category/content management, multiple
admin permission levels, MFA, audit logging, email notifications on
review decisions. The admin nav includes placeholder entries for
Disputes/Analytics/Catalog so the shape is visible, but no logic behind
them.

## Architecture

- New `admin/` directory at repo root: Next.js 15 (App Router) + TypeScript
  + Tailwind, its own `package.json`, deployed to Vercel independently
  from the Expo app. Same repo as the mobile app (not a separate repo) so
  the Supabase schema and generated types stay a single source of truth
  both apps import from.
- Supabase project is shared with the mobile app (same database). No new
  Supabase project.
- Admin authentication is **real Supabase email/password auth** — distinct
  from the mobile app's anonymous auth. An admin user is a normal
  `auth.users` row whose `id` also appears in a new `admins` table.
- Client-side Supabase calls (list queue, view a submission) run under
  RLS as the logged-in admin. Privileged writes (approve/reject, which
  must update another user's `profiles` row) run as **Next.js Server
  Actions using the Supabase service-role key**, kept server-side only
  and never sent to the browser. This avoids relying on RLS to let one
  user's session write another user's row, which is the kind of policy
  that tends to erode over time.
- No REST API layer, no separate backend service — consistent with how
  the mobile app already talks to Supabase directly.

## Data model

New migration, `supabase/migrations/0004_admin_verification.sql`:

```sql
-- admins: who is allowed into the admin app
create table public.admins (
  id uuid primary key references auth.users(id),
  email text not null,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

-- provider_verifications: one row per submission attempt
create table public.provider_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  doc_urls text[] not null default '{}',
  note text,                          -- rejection reason, set by reviewer
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.admins(id),
  reviewed_at timestamptz
);

create index provider_verifications_provider_idx
  on public.provider_verifications(provider_id);
create index provider_verifications_status_idx
  on public.provider_verifications(status);
```

RLS:
- `admins`: readable only by admins (`is_admin()`); no client inserts —
  admin accounts are provisioned manually via SQL/service role for this
  sub-project (no admin-invite UI yet).
- `provider_verifications`: a provider can `select`/`insert` their own
  rows (`auth.uid() = provider_id`); admins can `select` all rows.
  `update` (the approve/reject transition) happens only through the
  service-role server action, not via a client-facing RLS `update`
  policy — keeps the state transition in one reviewable code path.
- Approving a submission (inside the same server action, one
  transaction) sets `provider_verifications.status = 'approved'`,
  `reviewed_by`, `reviewed_at`, and `profiles.provider_verified = true`.
  Rejecting sets `status = 'rejected'` + `note` and leaves
  `provider_verified` untouched (stays false, provider can resubmit).

Storage: new private bucket `verification-docs`. Path convention
`{provider_id}/{verification_id}/{filename}`. RLS: a provider can
`insert`/`select` under their own `provider_id` prefix; admins can
`select` any path (via `is_admin()`); no public access.

## Admin web app

Screens:
- `/login` — Supabase email/password sign-in. Redirects to `/verifications`
  on success. A signed-in user who is not in `admins` is signed out and
  shown an "not an admin account" message.
- `/verifications` — queue: pending count, table of submissions
  (provider name, category, submitted date), sorted oldest-first.
  Filter by status (pending default / approved / rejected).
- `/verifications/[id]` — detail: provider's existing profile info
  (name, category, contact, area), the submitted document images, and
  Approve / Reject actions. Reject requires a non-empty reason (goes
  into `note`).
- Nav shell with Verifications (live) plus Disputes / Analytics /
  Catalog as disabled "coming soon" placeholders — sets the shape for
  later sub-projects without building them now.

Auth guard: a root layout server-side check redirects any
unauthenticated or non-admin request to `/login`.

## Mobile app changes

- New screen `VerifyBusinessScreen` (provider stack), reached from a new
  row/CTA on the existing provider `ProfileScreen.tsx`.
- Provider picks 1–3 photos (ID required, business certificate optional)
  via `expo-image-picker` (new dependency — not currently installed;
  exact API confirmed against the pinned Expo 57 docs before
  implementation per `AGENTS.md`). Images upload to
  `verification-docs/{provider_id}/...`, then a `provider_verifications`
  row is inserted with `status = 'pending'`.
- `ProfileScreen` shows a status pill sourced from the provider's latest
  `provider_verifications` row: **Not submitted** (no row yet) /
  **Pending review** / **Verified** / **Rejected — {note}** (with a
  "resubmit" affordance that re-opens `VerifyBusinessScreen`).
- If a provider is already `provider_verified = true` from seed data
  (no verification row), profile shows a **Verified** pill with no
  submission history — treated as pre-verified, not blocking anything.

## Error handling & edge cases

- Upload failure (network drop mid-upload): keep the screen in a
  retryable state, don't create a `provider_verifications` row until all
  selected images have confirmed-uploaded URLs.
- Duplicate pending submission: if a provider already has a `pending`
  row, `VerifyBusinessScreen` shows that pending state instead of the
  upload form (no second concurrent submission).
- Admin approves/rejects a submission that a second admin already
  resolved (race): server action checks current `status = 'pending'`
  before writing; a second reviewer sees a "already reviewed" error
  instead of silently overwriting.
- Admin account with no matching `admins` row can authenticate against
  Supabase but is immediately signed out client-side and server-side
  (layout guard) — never reaches `/verifications`.
- Empty queue renders a plain empty state, not an error.

## Testing

- Mobile: existing project has no test runner configured (verified: no
  `test` script wired to a framework beyond the Expo default) — this
  sub-project doesn't introduce one; `VerifyBusinessScreen` is verified
  manually via `/run` against seed data, same as other screens in this
  codebase.
- Admin web: unit tests for the server actions (approve/reject state
  transitions, the "already reviewed" race check) since that's where the
  privileged logic lives; `admin/` gets its own lightweight test setup
  (Vitest) since it's a separate package.
- Migration: applied against a local/dev Supabase instance and checked
  against seed data (`supabase/seed/seed.sql`) before merging.
