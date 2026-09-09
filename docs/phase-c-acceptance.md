# Phase C — Acceptance Report

Date: 2026-09-09  
Scope: Trust & location — verification, service areas, availability, portfolio, PostGIS, provider search

## Gap report

See [phase-c-gap.md](./phase-c-gap.md).

## Implemented

| Deliverable | Location |
|---|---|
| PostGIS + centroids + areas + availability + `verification_level` | `supabase/migrations/0012_trust_location.sql` (applied remotely) |
| Portfolio table + storage | migration `provider_portfolio` applied remotely |
| Geo search respects RADIUS / CITY / radius meters | `search_providers_geo` (fixed + applied) |
| Nest search / areas / availability / verification / portfolio | `api/src/providers/*` |
| Admin approve sets verification level | `admin/app/verifications/[id]/actions.ts` |
| Mobile CITY + km radius coverage | `ServiceAreasScreen` + `src/api/location.ts` |
| Availability modes | `AvailabilityScreen` |
| Verification level labels | `src/lib/verification.ts` + profile/detail screens |
| Customer browse via Nest geo search | `src/api/marketplace.ts` |

## Exit scenario mapping

| Step | Support |
|---|---|
| Provider submits identity verification | Existing Verification screen → `provider_verifications` |
| Admin approves | Admin actions → `IDENTITY_VERIFIED` + `provider_verified` |
| Provider sets a 10 km service radius | Service areas UI: hub neighborhood + **10 km** chip → RADIUS row |
| Customer searches for providers nearby | `GET /providers/search` → `search_providers_geo` |
| Provider appears when geographically eligible | RADIUS / CITY / profile-location-within-radius only |

## Remote migrations applied

Via Supabase MCP:

- `identity_roles_skills`
- `enable_postgis`
- `trust_location`
- `provider_portfolio`
- `fix_geo_search_and_backfill_areas`

## Tests / build

Run in `api/`: `npm test` && `npm run build`

## Not in Phase C

- Device GPS map picker
- Full ladder submission (PROFESSION / EXPERIENCE)
- Nest matching feed (Phase D)
- Quote/job ownership (Phases E–F)

## Next

**Phase D — Request marketplace:** Nest-owned requests, attachments, matching, provider opportunity feed.
