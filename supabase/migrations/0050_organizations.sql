-- Phase K: organization platform — businesses/agencies, members, projects,
-- workforce requests (service_requests owned by an org), and recurring services.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  phone text,
  email text,
  area text,
  owner_id uuid not null references public.profiles(id),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_owner_idx on public.organizations (owner_id);
create index if not exists organizations_status_idx on public.organizations (status);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create index if not exists organization_members_profile_idx
  on public.organization_members (profile_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  location_label text not null default '',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_org_idx on public.projects (organization_id, created_at desc);

alter table public.service_requests
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists service_requests_org_idx
  on public.service_requests (organization_id)
  where organization_id is not null;

create index if not exists service_requests_project_idx
  on public.service_requests (project_id)
  where project_id is not null;

create table if not exists public.recurring_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category_id text not null,
  category_label text not null,
  description text not null default '',
  location_label text not null,
  budget integer not null check (budget > 0),
  cadence text not null check (cadence in ('weekly', 'biweekly', 'monthly')),
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists recurring_services_due_idx
  on public.recurring_services (next_run_at)
  where active = true;

-- Membership helpers (security definer so RLS can call them).
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org_id and m.profile_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org_id
      and m.profile_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.recurring_services enable row level security;

drop policy if exists "members read organizations" on public.organizations;
create policy "members read organizations"
  on public.organizations for select
  using (public.is_admin() or public.is_org_member(id));

drop policy if exists "owners update organizations" on public.organizations;
create policy "owners update organizations"
  on public.organizations for update
  using (public.is_admin() or public.is_org_admin(id));

-- Inserts go through Nest (service role). Members can still read membership.
drop policy if exists "members read membership" on public.organization_members;
create policy "members read membership"
  on public.organization_members for select
  using (public.is_admin() or public.is_org_member(organization_id) or profile_id = auth.uid());

drop policy if exists "members read projects" on public.projects;
create policy "members read projects"
  on public.projects for select
  using (public.is_admin() or public.is_org_member(organization_id));

drop policy if exists "members read recurring" on public.recurring_services;
create policy "members read recurring"
  on public.recurring_services for select
  using (public.is_admin() or public.is_org_member(organization_id));
