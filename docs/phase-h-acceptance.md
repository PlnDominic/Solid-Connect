# Phase H — Acceptance

Date: 2026-09-28  
Scope: Reviews and disputes

## Implemented

| Deliverable | Location |
|---|---|
| Review + dispute rules | `api/src/trust/trust.rules.ts` |
| `POST /reviews`, `GET /reviews?providerId=` | `api/src/trust/*` |
| `POST /disputes`, `GET /jobs/:jobId/dispute` | same |
| Evidence table | `supabase/migrations/0048_dispute_evidence.sql` |
| Rate job via Nest when the API is configured | `src/api/reviews.ts` |
| Dispute form with photos | `src/screens/shared/DisputeScreen.tsx` |
| Admin shows dispute photos | `admin/app/(protected)/disputes/[id]/page.tsx` |

## Rules

- Only the customer of a **completed** job can leave one rating (1–5) and an optional note.
- A dispute can be filed while the job is still open, or within 48 hours of `completed_at`.
- Admin resolution (note + optional refund) stays on the existing admin dispute page.

## Not in Phase H

- Push when a review or dispute is filed (Phase I).
- Provider replies inside the dispute thread (chat on the job remains the conversation).
