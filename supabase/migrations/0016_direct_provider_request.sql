-- Direct (provider-targeted) requests: notify only the chosen provider.

alter table public.service_requests
  add column if not exists preferred_provider_id uuid references public.profiles(id) on delete set null;

create index if not exists service_requests_preferred_provider_idx
  on public.service_requests (preferred_provider_id)
  where preferred_provider_id is not null;

comment on column public.service_requests.preferred_provider_id is
  'When set, matching creates a single opportunity for this provider only (direct hire).';
