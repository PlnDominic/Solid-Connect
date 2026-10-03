-- Evidence photos attached to a customer dispute.

create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  photo_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists dispute_evidence_dispute_idx on public.dispute_evidence (dispute_id);

alter table public.dispute_evidence enable row level security;

drop policy if exists "job parties and admins read dispute evidence" on public.dispute_evidence;
create policy "job parties and admins read dispute evidence"
  on public.dispute_evidence for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (d.customer_id = auth.uid() or d.provider_id = auth.uid())
    )
  );

drop policy if exists "customers attach evidence to their disputes" on public.dispute_evidence;
create policy "customers attach evidence to their disputes"
  on public.dispute_evidence for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id and d.customer_id = auth.uid()
    )
  );
