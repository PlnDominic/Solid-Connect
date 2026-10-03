# Phase G — Gap

Date: 2026-09-28  
Scope: Hubtel collection, escrow, commission payout

## Before

- `payments` / `provider_payouts` existed, but confirming a job flipped `pending` → `released` with no gateway.
- No checkout, webhook, or Mobile Money send.

## After

- Customer pays the job quote through Hubtel Online Checkout.
- Webhook is accepted only after Hubtel's transaction-status API says paid. Row becomes `held` (escrow).
- Confirming completion releases `held` (and still `pending` when Hubtel is not configured) and creates a commission-net `provider_payouts` row.
- When Hubtel credentials are set, confirm is blocked until the payment is `held`, then Nest sends the net amount to the provider's profile phone via Hubtel Send Money.
