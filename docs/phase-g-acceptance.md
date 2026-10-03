# Phase G — Acceptance

Date: 2026-09-28  
Gateway: Hubtel

## Implemented

| Deliverable | Location |
|---|---|
| `held` status + gateway columns | `supabase/migrations/0047_hubtel_payments.sql` |
| Checkout, status refresh, webhook | `POST /api/v1/payments/jobs/:jobId/checkout`, `.../refresh`, `POST /api/v1/payments/webhooks/hubtel` |
| Confirm requires escrow when Hubtel is configured; then MoMo payout | `api/src/jobs/jobs.service.ts`, `api/src/payments/*` |
| Customer Pay with Hubtel | `src/screens/customer/JobDetailScreen.tsx` |
| Admin `held` filter | `admin/app/(protected)/payments/page.tsx` |

## Money flow

1. Job accept still creates a `pending` payment for the quote amount.
2. Customer opens Hubtel checkout (MoMo or card).
3. Callback + status check sets `held`.
4. Customer confirms completion → `released`, payout row = amount × (1 − commission).
5. Hubtel Send Money pays that net to the provider phone (MTN / Telecel / AirtelTigo).

## Config

Set on the Nest API (`api/.env.example`): `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `HUBTEL_MERCHANT_ACCOUNT`, `HUBTEL_CALLBACK_URL`. Optional `HUBTEL_PREPAID_ACCOUNT` if Send Money uses a different deposit account.

Until those are set, checkout returns `PAYMENTS_NOT_CONFIGURED` and confirm still releases a simulated `pending` payment.

## Not in Phase G

- Card refunds back through Hubtel (admin refund statuses stay manual).
- Push when a payout lands.
