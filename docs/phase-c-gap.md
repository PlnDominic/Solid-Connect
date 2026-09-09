# Phase C — Gap Report (Trust & Location)

## EXISTING (after Phase C)
- PostGIS + Accra centroids, service areas, availability, verification levels
- Nest search / areas / availability / verification / portfolio read
- Mobile ServiceAreas (CITY + optional km radius), Availability, geo browse
- Admin approve advances `verification_level`
- Portfolio table + storage bucket applied remotely

## PARTIAL
- Verification ladder UI only surfaces current level (no PROFESSION/EXPERIENCE submit flows yet)
- Matching feed still client-side until Phase D

## MISSING (deferred)
- Live GPS / map picker
- Nest-owned matching opportunity feed (Phase D)

## CONFLICTING (resolved for discovery)
- Spec: PostGIS eligibility → `search_providers_geo` + Nest `/providers/search`
- Mobile falls back to rating/string sort only when API/coords unavailable
