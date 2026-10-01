# Phase K — Acceptance

Date: 2026-10-01  
Scope: Organization platform

## Implemented

| Deliverable | Location |
|---|---|
| Schema | `supabase/migrations/0050_organizations.sql` |
| Nest API | `api/src/organizations/*` · `/api/v1/organizations` |
| Recurring worker | `api/src/organizations/recurring.worker.ts` |
| Admin directory | `admin/app/(protected)/organizations/` |
| Mobile | Profile → Organizations · `src/screens/shared/Organizations*.tsx` |
| Seeded demo org | Accra Facilities Ltd (owner: `efua.customer@solidconnect.test`) |

## API surface

- `POST/GET /organizations`, `GET/PATCH /organizations/:id`
- Members: `POST/PATCH/DELETE .../members`
- Projects: `GET/POST/PATCH .../projects`
- Workforce requests: `GET/POST .../requests` (creates a normal matched `service_request`)
- Recurring: `POST/PATCH .../recurring` (weekly / biweekly / monthly)

## Rules

- Creator becomes owner. Only owners and admins can add members or schedule recurring work.
- Any member can create a project or workforce request.
- Recurring services that are due create a workforce request and advance `next_run_at`.

## Not in Phase K

- Separate business-only Next.js portal (orgs use the mobile app + admin oversight).
- Contracts, subscriptions, or workforce optimization (Phase L / later).
