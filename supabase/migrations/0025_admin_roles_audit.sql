-- Admin role tiers, soft-disable, and an audit trail for admin actions.
--
-- Every existing admin row defaults to 'owner' (full access, same as
-- today) so this migration cannot silently downgrade anyone already
-- provisioned - only a deliberate, later role change can.

alter table public.admins
  add column if not exists role text not null default 'owner'
    check (role in ('owner', 'support'));

alter table public.admins
  add column if not exists disabled_at timestamptz;

alter table public.admins
  add column if not exists invited_by uuid references public.admins(id);

-- is_admin() now excludes disabled admins, so disabling someone here
-- revokes every RLS policy across the app that gates on is_admin() - not
-- just the app-layer login redirect.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid() and disabled_at is null);
$$;

-- Owners can manage the admin team and read the audit log; support admins
-- keep doing everything an admin can already do today (verifications,
-- disputes, etc.) but can't add/remove/promote other admins or see who
-- did what.
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid() and disabled_at is null and role = 'owner');
$$;

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admins(id),
  -- Denormalized: survives even if the admin row is later removed outright
  -- (today's UI only ever soft-disables, but the log shouldn't depend on that).
  admin_email text not null,
  action text not null,
  target_type text,
  target_id text,
  note text,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

-- Only owners read the audit trail. Every write goes through the
-- service-role client from server actions (same convention this codebase
-- already uses for every other admin-side mutation), which bypasses RLS
-- by design - so there is deliberately no insert policy here.
create policy "owners read audit log" on public.admin_audit_log for select using (public.is_owner());
