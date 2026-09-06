# Provider Portfolio Photos

Status: approved for planning
Date: 2026-09-06

## Context

Providers currently have no way to show past work. `docs/marketplace-mechanics.md`
and `docs/system-architecture.md` both name "portfolio" as part of the provider
marketplace module, but nothing in the schema, storage, or app implements it —
verified by grepping the whole repo for "portfolio": only the four docs files
match, no code. This is a new subsystem, not a wire-up of an existing flow
(unlike the verification screen, which reused a fully provisioned
`provider_verifications` table + `verification-docs` bucket).

The nearest precedent is that verification flow (`supabase/migrations/
0005_admin_verification.sql`, `src/api/verification.ts`,
`src/screens/provider/VerificationScreen.tsx`): a per-provider Storage bucket
with folder-scoped RLS, a table of uploaded items, and a TanStack Query API
module. Portfolio photos differ in one important way: verification documents
are private (admin + owner only); portfolio photos are meant for customers to
browse, so they're public by design.

## Scope

This sub-project covers:

1. A new migration: `provider_portfolio_photos` table + a public
   `portfolio-photos` Storage bucket, both with RLS.
2. A new API module (`src/api/portfolio.ts`): list / upload / delete.
3. A new provider-side screen (`src/screens/provider/PortfolioScreen.tsx`) to
   manage (add/remove) portfolio photos, wired into the provider `ProfileStack`
   and settings list.

Out of scope (future sub-projects, not designed here): a customer-facing
screen to browse a provider's portfolio (blocked on the not-yet-built Provider
Detail screen), captions/descriptions per photo, manual reordering, and any
cap enforced at the database level (client-side cap only, matching how
`VerificationScreen`'s `MAX_DOCS` is enforced).

## Data model

New migration, `supabase/migrations/0007_provider_portfolio.sql`:

```sql
create table public.provider_portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

create index provider_portfolio_photos_provider_idx
  on public.provider_portfolio_photos(provider_id, created_at);

alter table public.provider_portfolio_photos enable row level security;

create policy "portfolio photos are publicly readable"
  on public.provider_portfolio_photos for select using (true);
create policy "providers manage their own portfolio photos"
  on public.provider_portfolio_photos for insert with check (auth.uid() = provider_id);
create policy "providers delete their own portfolio photos"
  on public.provider_portfolio_photos for delete using (auth.uid() = provider_id);

insert into storage.buckets (id, name, public) values ('portfolio-photos', 'portfolio-photos', true)
on conflict (id) do nothing;

create policy "providers upload their portfolio photos" on storage.objects for insert
  with check (bucket_id = 'portfolio-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "providers delete their portfolio photos" on storage.objects for delete
  using (bucket_id = 'portfolio-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "portfolio photos are publicly readable" on storage.objects for select
  using (bucket_id = 'portfolio-photos');
```

Unlike `verification-docs`, there is no `update`/admin policy at all here —
no review workflow, no privileged writer. A provider's own `insert`/`delete`
plus an unconditional public `select` (table row and storage object both) is
the complete policy set.

## API (`src/api/portfolio.ts`, new)

- `usePortfolioPhotos(providerId)` — `select * from provider_portfolio_photos
  where provider_id = ? order by created_at desc`.
- `useUploadPortfolioPhoto()` — mutation: uploads one picked image to
  `portfolio-photos/{providerId}/{timestamp}.jpg`, calls
  `supabase.storage.from('portfolio-photos').getPublicUrl(path)` (no signing
  needed - public bucket), inserts one row with that public URL. Invalidates
  `['portfolio', providerId]` on success.
- `useDeletePortfolioPhoto()` — mutation: takes `{id, photoUrl}`, derives the
  storage path back from the public URL (everything after
  `/object/public/portfolio-photos/`), removes the Storage object, then
  deletes the row. Invalidates `['portfolio', providerId]` on success.

## Screen (`src/screens/provider/PortfolioScreen.tsx`, new)

- `ScreenHeader title="Portfolio"` + back, same shell as other provider
  settings screens.
- A photo grid (3 columns), not a list - these are meant to be browsed
  visually, unlike verification's document slots. Each cell shows the photo
  with a small × overlay to delete.
- A trailing "Add photo" cell (dashed border, `ImagePlus` icon, same visual
  language as `VerificationScreen`'s add-tile) shown whenever the provider has
  fewer than 12 photos. Tapping it picks **one** image at a time
  (`expo-image-picker`, `allowsMultipleSelection: false` - unlike
  verification's batch pick, since each portfolio photo uploads and inserts
  independently rather than as one batch) and immediately uploads it, so the
  grid updates without a separate "submit" step.
- `EmptyState` ("No portfolio photos yet" / "Add photos of your past work so
  customers can see what you do.") when the grid is empty.
- Per-cell delete shows an inline `ActivityIndicator` on that cell while its
  delete mutation is in flight; the add-tile shows one while an upload is in
  flight, both disabled during their own operation only (not the whole
  screen) so multiple photos can be managed without blocking each other.

## Wiring

- `src/navigation/ProviderTabs.tsx`: register `Portfolio` in `ProfileStack`.
- `src/screens/provider/ProfileScreen.tsx`: add a "Portfolio" row to
  `SETTINGS_ROWS`, next to "Verification".
- `src/types/database.ts`: add `ProviderPortfolioPhoto` interface and its
  `Database.public.Tables` entry, matching the existing per-table pattern.

## Error handling & edge cases

- Upload failure: the add-tile shows an inline error message below the grid
  and returns to its normal (non-loading) state; no partial row is created
  (upload happens before insert, same order as verification's flow).
- Delete failure: the photo stays in the grid with an inline error message;
  no optimistic removal, since a public URL that fails to delete but is
  removed from the UI silently could resurface confusingly on next reload.
- Reaching the 12-photo cap simply hides the add-tile - no error state,
  since it's a soft, client-enforced limit rather than something a provider
  can violate through normal use of this screen.
- A provider with zero photos and mid-flight first upload: grid shows just
  the add-tile (in its loading state) until the upload completes, then the
  new photo and a fresh add-tile.

## Testing

- No test runner exists in this repo (confirmed for the verification screen
  spec and still true) - this screen is verified manually via `/run` and
  `tsc --noEmit`, same as `VerificationScreen` and `SavedProvidersScreen`.
- Migration: applied against the project's Supabase instance and checked
  that both RLS policy sets (table + storage) behave as intended (owner can
  insert/delete own rows/objects, anyone can read) before merging.
