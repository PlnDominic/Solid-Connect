# Phase F — Acceptance Report

Date: 2026-09-09  
Scope: Jobs lifecycle, events, chat, realtime delivery, completion

## Gap report

See [phase-f-gap.md](./phase-f-gap.md).

## Implemented

| Deliverable | Location |
|---|---|
| `job_events` + provider/customer completion timestamps | `0015_jobs_chat.sql` (applied) |
| RPCs `advance_job`, `confirm_job_completion` | same |
| Nest jobs list/get/events/advance/confirm | `api/src/jobs/*` |
| Nest chat threads + send message | `api/src/chat/*` |
| Mobile advance/confirm via Nest when API set | `src/api/jobs.ts` |
| Mobile chat create/list/send via Nest; Realtime kept | `src/api/chat.ts` |
| Provider awaits customer after step 5 | `JobDetailScreen` (provider) |
| Customer confirm gated until provider done | `JobDetailScreen` (customer) |

## Exit scenario mapping

| Step | Support |
|---|---|
| Customer ↔ provider communicate | Nest chat send + Supabase Realtime INSERT |
| Provider starts / advances work | `POST /jobs/:id/advance` |
| Provider completes work | advance to step 5 → `PROVIDER_COMPLETED` event |
| Customer confirms completion | `POST /jobs/:id/confirm` → job completed + payment released |

## Tests / build

`api/`: `npm test` && `npm run build` (16 tests)

## Not in Phase F

- Real MoMo payouts (Phase G)
- Push notifications on message/job events (Phase I)
- Full Nest WebSocket gateway (Realtime via Supabase is intentional)

## Next

**Phase G — Payments:** gateway, transactions, commission, payout, refunds, webhooks.
