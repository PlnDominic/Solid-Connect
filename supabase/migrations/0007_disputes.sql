-- Customer disputes on jobs. Types already reference this as 0007 in
-- src/types/database.ts. Resolution is an admin action.

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  reason text not null
    check (reason in ('not_completed', 'poor_quality', 'overcharged', 'no_show', 'other')),
  description text not null default '',
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id)
);

create index disputes_status_idx on public.disputes(status, created_at desc);
create index disputes_provider_idx on public.disputes(provider_id);

alter table public.disputes enable row level security;

create policy "customers read their own disputes"
  on public.disputes for select
  using (auth.uid() = customer_id or auth.uid() = provider_id or public.is_admin());

create policy "customers open disputes on their jobs"
  on public.disputes for insert
  with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.customer_id = auth.uid() and j.provider_id = provider_id
    )
  );

create policy "admins resolve disputes"
  on public.disputes for update
  using (public.is_admin());
