# Phase I — Acceptance

Date: 2026-09-28  
Scope: Notifications

## Implemented

| Deliverable | Location |
|---|---|
| Preference, token, and deep-link rules | `api/src/notifications/push.rules.ts` |
| Background sender and receipt check | `api/src/notifications/push.service.ts`, `push.worker.ts` |
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
