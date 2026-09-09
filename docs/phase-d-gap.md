# Phase D — Gap Report (Request Marketplace)

## EXISTING
- `service_requests` + `quotes` tables, RLS
- Mobile create request (direct Supabase insert, status `matching`)
- Request photo upload to Storage (bucket may be missing remotely)
- Provider FeedScreen: all open/matching/quoted requests, client string-rank
- `useSimulateQuotesArriving`: client invents quotes / seed fallback

## PARTIAL
- Attachments: photos[] on request; `0010_request_photos` storage policies not confirmed remote
- Category/area heuristics only — no PostGIS eligibility, no opportunity records

## MISSING
- Nest-owned request create + matching orchestration
- `request_opportunities` (eligible providers notified for a request)
- Request `location` geography for spatial match
- Provider feed filtered to matched opportunities
- Server-side discovery using skills/category + service areas + availability

## CONFLICTING
- Spec: Nest discovers eligible providers; providers receive opportunities
- Current: mobile inserts request; feed shows everyone; “matching” is fake quote insertion
- Resolution: Nest `POST /requests` runs matcher → writes opportunities; feed reads Nest opportunities; keep quote UI for Phase E

## Plan
1. Migration `0013_request_matching.sql` (+ apply request-photos bucket)
2. Nest RequestsModule: create, match, feed, get
3. Mobile create + feed via API when configured
4. Tests + acceptance
