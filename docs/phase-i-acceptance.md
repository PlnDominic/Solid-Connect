# Phase I — Acceptance

Date: 2026-09-28  
Scope: Notifications

## Implemented

| Deliverable | Location |
|---|---|
| Preference, token, and deep-link rules | `supabase/migrations/0092_push_and_expiry_in_database.sql` |
| Background sender and receipt check | `supabase/migrations/0092_push_and_expiry_in_database.sql` (test: `supabase/tests/push-in-database.test.mjs`) |
| Queue instead of an inline Expo call | `supabase/migrations/0049_push_outbox.sql` |
| Provider notified on a new review | `api/src/trust/trust.service.ts` |
| Clear-all inbox | `POST /api/v1/requests/notifications/read-all` |
| Live inbox | `src/api/requests.ts` |

## Rules

- Job updates, quotes, and messages push by default. Promotions push only when that preference is on.
- Only an Expo push token is sent. Expo delivers that to FCM on Android and APNs on iOS.
- A job notification opens the job. Anything else opens the inbox.
- `EXPO_ACCESS_TOKEN` is optional. Leave it blank until the Expo project has a token.

## Not in Phase I

- A separate Firebase or APNs credential in this API. Expo is the transport.
- Email or SMS alerts.
