# Phase F — Gap Report (Jobs & Communication)

## EXISTING
- `jobs` with step 1–5, status in_progress/completed
- Provider advances steps client-side; customer confirms + releases payment client-side
- Chat threads/messages via Supabase; Realtime INSERT subscription on mobile
- Thread created on quote accept

## PARTIAL
- Communication works; job lifecycle rules not Nest-owned
- No durable job event log

## MISSING
- `job_events` audit trail
- Nest job advance / provider-complete / customer-confirm
- Nest chat send (+ thread list) with participant checks
- Clear split: provider marks done → customer confirms → payment released

## CONFLICTING
- Spec: Nest owns job completion transitions
- Current: mobile updates jobs/payments directly
- Resolution: RPCs + JobsModule/ChatModule; mobile calls API when configured; keep Supabase Realtime for message delivery

## Plan
1. Migration `0015_jobs_chat.sql`
2. Nest jobs + chat endpoints
3. Mobile wire advance/confirm/send
4. Tests + acceptance
