# Phase E — Gap Report (Quotations)

## EXISTING
- `quotes` table (unique per request/provider; status sent/accepted/declined)
- Provider `useSendQuote` inserts quote + sets request `quoted`
- Customer `useAcceptQuote` accepts one, declines others, creates job + payment + chat (all client Supabase)
- RequestsScreen compares quotes UI
- Demo `useSimulateQuotesArriving` invents quotes

## PARTIAL
- Comparison UX exists; business rules live on the mobile client

## MISSING
- Nest-owned quote create / revise / list / accept
- Quote revision fields (`note`, `updated_at`, `revision`)
- Server validation: eligible providers only; customer-only accept; one job; close sibling quotes
- Atomic accept → job creation (RPC)

## CONFLICTING
- Spec: Nest owns accept-quote and job creation
- Current: mobile decides status transitions
- Resolution: Nest QuotesModule + `accept_quote` RPC; mobile calls API when configured

## Plan
1. Migration `0014_quote_accept.sql`
2. Nest quote create/revise/list/accept
3. Mobile send + accept via API
4. Tests + acceptance
