# Profile Photo + Tagline

Status: approved for planning
Date: 2026-09-06

## Context

Driven by a pinned visual reference: a photo-hero profile header (full-bleed
photo, circular avatar overlay, name, short tagline) supplied directly by the
user for the customer/provider Profile screens. Neither account type has a
real photo or bio field today - `profiles` only has `initials` (rendered via
the `Avatar` component's rounded-square initials frame). This is a new,
small subsystem, same shape as `provider_verifications` (0005) and
`provider_portfolio_photos` (0008): a Storage bucket with owner-scoped
insert/update RLS and public read.

Unlike portfolio (many photos per provider), a profile photo is 1:1 with the
account and applies to both customer and provider roles, so it belongs as a
column on `profiles` directly rather than a separate table.

## Scope

1. Migration: `profiles.photo_url` and `profiles.tagline` columns (both
   nullable, default null - no fabricated placeholder copy) + a public
   `profile-photos` Storage bucket with owner-scoped RLS.
2. `useUploadProfilePhoto()` mutation in `src/api/profile.ts`.
3. Tagline becomes an editable field on `EditProfileScreen.tsx` (optional,
   free text, reasonable length cap).
4. Both Profile screens' hero header rebuilt around the photo/tagline,
   replacing the current identity row layout (subject of the immediately
   following implementation, not a separate plan).

Out of scope: cropping/editing tools beyond the OS picker, multiple
photos, a public-facing screen showing someone else's profile+tagline
(follows once Provider Detail exists) - this migration's public `select`
policy just makes that possible later without another schema change.

## Data model

New migration, `supabase/migrations/0009_profile_photo.sql`:

```sql
alter table public.profiles add column photo_url text;
alter table public.profiles add column tagline text;

insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "users upload their own profile photo" on storage.objects for insert
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update their own profile photo" on storage.objects for update
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own profile photo" on storage.objects for delete
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile photos are publicly readable" on storage.objects for select
  using (bucket_id = 'profile-photos');
```

No new RLS needed on `profiles` itself - the existing policies from
`0001_init.sql` already let a user update their own row and everyone read
public profile data.

## API

`useUploadProfilePhoto()` (new, `src/api/profile.ts`): uploads one picked
image to `profile-photos/{userId}/{timestamp}.jpg` (overwriting-by-new-path,
same convention as verification/portfolio), calls `getPublicUrl`, updates
`profiles.photo_url`, and updates `useSessionStore`'s cached profile so the
new photo renders immediately without a refetch.

Tagline is plain text saved through the existing `updateOwnProfile` path
(`src/api/profile.ts`) - add `tagline` to its `updates` parameter and to the
`.update()` call, same as the other editable fields.

## UI

- Hero header: full-bleed image container (the uploaded photo, or a flat
  navy panel - `colors.navy` - when `photo_url` is null, never a broken
  `<Image>`), circular avatar-photo overlay (falls back to the existing
  initials `Avatar` when there's no photo yet), name and tagline in white
  text over the image with a subtle bottom gradient scrim for legibility
  (a real depth technique for text-over-photo legibility, not decoration -
  distinct from the "no glow shadows" rule which is about card elevation).
  Tapping the photo/avatar area opens `expo-image-picker` and uploads
  immediately, matching the portfolio add-tile's tap-to-upload pattern.
- `EditProfileScreen.tsx`: one new multiline text field for tagline, under
  the existing fields, optional (empty is valid).
- Settings rows keep their existing labels/navigation targets but gain a
  leading icon (`lucide-react-native`, already a dependency) and are
  regrouped into two card sections instead of one, matching the reference.

## Error handling & edge cases

- Upload failure: hero shows its previous state (existing photo, or the
  navy placeholder) unchanged; an inline error message appears below the
  hero. No partial state - `photo_url` is only updated after the Storage
  upload confirms.
- A user with no photo and no tagline sees the navy placeholder panel and
  no tagline text (not a placeholder sentence) - avoids fabricating content
  per `PRODUCT.md`'s standing rule against invented copy.
- Tagline has a length cap (140 characters) enforced client-side in
  `EditProfileScreen`, consistent with how other text fields there validate
  before `Save changes` enables.

## Testing

No test runner in this repo (unchanged from the Portfolio/Verification
specs) - verified manually via `/run` and `tsc --noEmit`.
