-- Solid Connect - three gaps from the "20 more things" list:
--   1. Terms/privacy acceptance recorded at sign-up (was never captured).
--   2. Self-service account deletion requests (was email-support-only).
--  13. Notification preferences moved server-side, so an admin broadcast
--      can honor the "promotions" opt-out docs/legal/privacy-policy.md §2
--      promises (previously local-only AsyncStorage, invisible to the
--      server entirely - see admin/app/(protected)/broadcast/actions.ts).

-- ── 1. Terms & privacy acceptance ──────────────────────────────────────
-- terms_version records which wording was agreed to (src/lib/legal.ts's
-- LEGAL_VERSION at the time), so a future rewrite of the in-app summary
-- can tell "agreed before the rewrite" apart from "agreed after" without
-- guessing from the timestamp alone.
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

alter table public.profiles
  add column if not exists terms_version text;

-- ── 2. Self-service account deletion requests ──────────────────────────
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.admins(id),
  reviewed_at timestamptz,
  admin_note text
);

create index if not exists account_deletion_requests_status_idx
  on public.account_deletion_requests (status, requested_at desc);

-- One open request per user at a time - resubmitting while pending
-- doesn't help the admin queue, it would just pile up duplicate rows.
create unique index if not exists account_deletion_requests_one_pending_idx
  on public.account_deletion_requests (user_id) where status = 'pending';

alter table public.account_deletion_requests enable row level security;

do $$ begin
  create policy "users insert own deletion request" on public.account_deletion_requests for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users read own deletion request" on public.account_deletion_requests for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users cancel own pending deletion request" on public.account_deletion_requests for update
    using (auth.uid() = user_id and status = 'pending')
    with check (auth.uid() = user_id and status = 'cancelled');
exception when duplicate_object then null; end $$;

-- Anonymizes a profile's identifying fields in place. Called by the admin
-- panel when it completes a deletion request, after also deleting the
-- auth.users row via the Supabase Auth admin API (SQL can't reach that -
-- see admin/app/(protected)/deletion-requests/actions.ts). Job, payment,
-- and review rows tied to the account are deliberately left alone: per
-- docs/legal/privacy-policy.md §6, another party's own accountability
-- history (a provider's job count, a customer's review) depends on the
-- job having happened, so those rows are anonymized by proxy through this
-- profile row, not deleted.
create or replace function public.anonymize_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    full_name = 'Deleted user',
    initials = '—',
    phone = null,
    email = null,
    area = 'Account deleted',
    photo_url = null,
    tagline = null,
    provider_category = null,
    push_token = null,
    push_permission_status = null,
    notification_prefs = '{}'::jsonb
  where id = p_user_id;
end;
$$;

revoke all on function public.anonymize_profile(uuid) from public;
grant execute on function public.anonymize_profile(uuid) to service_role;

-- ── 13. Server-side notification preferences ────────────────────────────
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default
    '{"jobUpdates": true, "newQuotes": true, "messages": true, "promotions": false}'::jsonb;
