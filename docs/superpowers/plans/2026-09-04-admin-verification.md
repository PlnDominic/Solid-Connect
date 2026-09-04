# Admin Dashboard Foundation + Provider Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new admin web app with real admin auth, and give it a working provider-verification queue backed by a real submission flow (replacing the bare `provider_verified` boolean) that providers can actually feed from the mobile app.

**Architecture:** A new `admin/` Next.js 15 (App Router) app in this repo, deployed separately from the Expo app, talking directly to the same Supabase project — no new backend/API layer. Admin reads run under RLS as the logged-in admin session; the one privileged write (approve/reject, which touches another user's row) runs through a Next.js Server Action using the Supabase service-role key, never exposed to the browser. The mobile app gets one new screen so providers can submit ID/business-cert photos, which land in a private Storage bucket and a `provider_verifications` row the admin app reviews.

**Tech Stack:** Next.js 15 + React 19 + TypeScript + Tailwind CSS 3 (admin/), `@supabase/ssr` + `@supabase/supabase-js` for admin auth/data, Vitest for the admin app's server-action logic. Expo/React Native + TypeScript (existing `src/`), `expo-image-picker` + `expo-file-system` (both newly installed by this plan) for the mobile submission screen. Postgres/Supabase (existing project) for schema, RLS, and Storage.

**Spec:** `docs/superpowers/specs/2026-09-04-admin-verification-design.md`

## Global Constraints

- Migration file is `supabase/migrations/0005_admin_verification.sql`, **not** `0004` as the spec draft names it — `0004_phone_unique.sql` landed in this repo (unrelated in-progress work) after the spec was written, and migration numbers must stay unique/sequential.
- No REST API or separate backend service layer: both apps talk to Supabase directly. Admin reads run under RLS as the logged-in admin session; the approve/reject write runs through a server-side Supabase **service-role** client only, never sent to the browser.
- Admin auth is real Supabase email/password auth, distinct from the mobile app's anonymous auth. No self-serve admin signup in this plan — admin accounts are provisioned by inserting a row into `admins` directly (SQL) after creating the matching Supabase Auth user.
- Mobile code targets the exact Expo SDK 57 APIs (per `AGENTS.md`): `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], ... })` (array form, not the deprecated `MediaTypeOptions` enum), and `expo-file-system`'s new `File` class (`new File(uri).bytes()`), not the deprecated `readAsStringAsync`.
- Hand-written TypeScript types mirror the SQL migrations by convention in this codebase (see the header comment in `src/types/database.ts`) — no `supabase gen types` codegen dependency, in either app.
- The mobile app has no automated test runner; mobile tasks are verified with `npx tsc --noEmit` plus a manual run-through, matching this codebase's existing convention (see `README.md` / the design spec's Testing section). The admin app is a separate package and gets its own Vitest setup for the one piece of logic worth unit testing: the approve/reject state transition.

---

### Task 1: Database schema — admins, provider_verifications, storage bucket, RLS

**Files:**
- Create: `supabase/migrations/0005_admin_verification.sql`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: tables `public.admins(id, email, created_at)` and `public.provider_verifications(id, provider_id, status, doc_urls, note, submitted_at, reviewed_by, reviewed_at)`; function `public.is_admin() returns boolean`; storage bucket `verification-docs`. Every later task (mobile and admin) reads/writes these exact names.

- [ ] **Step 1: Write the migration**

```sql
-- Solid Connect - admin auth + provider verification
-- Adds the admin role (a real Supabase-auth account listed in `admins`,
-- distinct from the mobile app's anonymous auth) and a real provider
-- verification workflow (submission + documents + review), replacing the
-- bare `profiles.provider_verified` boolean with something that has
-- evidence behind it. See
-- docs/superpowers/specs/2026-09-04-admin-verification-design.md.

-- ── admins ──────────────────────────────────────────────────────────────
create table public.admins (
  id uuid primary key references auth.users(id),
  email text not null,
  created_at timestamptz not null default now()
);

comment on table public.admins is 'Admin web app accounts. No self-serve signup - rows are inserted manually (SQL/service role) after creating the matching auth.users account.';

-- security definer so RLS policies elsewhere can call this without granting
-- broad read access to public.admins itself.
create function public.is_admin() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

alter table public.admins enable row level security;

create policy "admins can read the admin list" on public.admins
  for select using (public.is_admin());

-- ── provider_verifications ─────────────────────────────────────────────
create table public.provider_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  doc_urls text[] not null default '{}',
  note text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.admins(id),
  reviewed_at timestamptz
);

comment on table public.provider_verifications is 'One row per provider verification attempt. Approve/reject is done by the admin app via a service-role server action, not a client-facing RLS update policy - see the design spec for why.';

create index provider_verifications_provider_idx on public.provider_verifications(provider_id);
create index provider_verifications_status_idx on public.provider_verifications(status);

alter table public.provider_verifications enable row level security;

create policy "providers see their own verification submissions" on public.provider_verifications
  for select using (auth.uid() = provider_id);
create policy "admins see all verification submissions" on public.provider_verifications
  for select using (public.is_admin());
create policy "providers submit their own verification" on public.provider_verifications
  for insert with check (auth.uid() = provider_id);
-- deliberately no client-facing update policy: approve/reject runs through
-- the admin app's service-role server action instead (see design spec).

-- ── verification-docs storage bucket ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

create policy "providers upload their own verification docs" on storage.objects
  for insert with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "providers read their own verification docs" on storage.objects
  for select using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "admins read all verification docs" on storage.objects
  for select using (
    bucket_id = 'verification-docs' and public.is_admin()
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0005_admin_verification.sql
git commit -m "Add admin + provider_verifications schema, RLS, storage bucket"
```

**This task does not apply the migration.** The implementer has no database
credentials for the live project (no `DATABASE_URL`, no authenticated
Supabase MCP) — the human owner applies it once ready, using whichever of
these they have available:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0005_admin_verification.sql
```

or paste the file's contents into the Supabase dashboard's SQL editor, or
`supabase db push` if the project is linked via the CLI. Afterward, this
structural check confirms the objects exist and are named correctly (a
direct Postgres connection bypasses RLS, so this does not prove RLS
behavior — that's proven for real in Task 3, a real provider submitting,
and Task 7, a real admin approving/rejecting):

```bash
psql "$DATABASE_URL" -c "select tablename from pg_tables where schemaname = 'public' and tablename in ('admins', 'provider_verifications');"
psql "$DATABASE_URL" -c "select policyname from pg_policies where tablename in ('admins', 'provider_verifications', 'objects') order by tablename;"
psql "$DATABASE_URL" -c "select id, public from storage.buckets where id = 'verification-docs';"
```

Expected: both tables listed; policies listed include `admins can read the admin list`, `providers see their own verification submissions`, `admins see all verification submissions`, `providers submit their own verification`, `providers upload their own verification docs`, `providers read their own verification docs`, `admins read all verification docs`; the bucket row shows `public = false`.

Tasks 3 and 7's manual end-to-end verification steps assume this migration
is already applied — hold those until it is.

---

### Task 2: Mobile — verification types + API layer

**Files:**
- Modify: `src/types/database.ts`
- Create: `src/api/verification.ts`

**Interfaces:**
- Consumes: `supabase` client from `src/lib/supabase.ts`; tables/bucket from Task 1.
- Produces: `ProviderVerification` type; `useLatestVerification(providerId)` query hook returning `ProviderVerification | null`; `useSubmitVerification(providerId)` mutation hook accepting `{ uri: string; fileName: string; mimeType: string }[]` and resolving to `ProviderVerification`. Task 3's screen and Task 3's `ProfileScreen` edit both consume these two hooks by these exact names.

- [ ] **Step 1: Add the verification types**

In `src/types/database.ts`, add after the existing `PaymentStatus` type declaration (`export type PaymentStatus = ...`):

```typescript
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
```

Add after the `Review` interface:

```typescript
export interface ProviderVerification {
  id: string;
  provider_id: string;
  status: VerificationStatus;
  doc_urls: string[];
  note: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}
```

In the `Database.public.Tables` object, add:

```typescript
      provider_verifications: { Row: ProviderVerification; Insert: Partial<ProviderVerification> & { provider_id: string }; Update: Partial<ProviderVerification> };
```

- [ ] **Step 2: Write the API layer**

Create `src/api/verification.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import type { ProviderVerification } from '../types/database';

const BUCKET = 'verification-docs';

export interface PickedDoc {
  uri: string;
  fileName: string;
  mimeType: string;
}

export async function fetchLatestVerification(providerId: string): Promise<ProviderVerification | null> {
  const { data, error } = await supabase
    .from('provider_verifications')
    .select('*')
    .eq('provider_id', providerId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useLatestVerification(providerId: string | null) {
  return useQuery({
    queryKey: ['verification', providerId],
    queryFn: () => fetchLatestVerification(providerId as string),
    enabled: !!providerId,
  });
}

async function uploadDoc(providerId: string, doc: PickedDoc, index: number): Promise<string> {
  const file = new File(doc.uri);
  const bytes = await file.bytes();
  const path = `${providerId}/${Date.now()}-${index}-${doc.fileName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: doc.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/**
 * Uploads each picked photo to the provider's own folder in the
 * verification-docs bucket, then inserts one provider_verifications row
 * referencing all of them - a submission is only created once every
 * upload has confirmed, so a mid-upload network drop never leaves a
 * pending row with missing documents.
 */
export async function submitVerification(providerId: string, docs: PickedDoc[]): Promise<ProviderVerification> {
  if (docs.length === 0) throw new Error('Add at least one document photo.');
  const docUrls = await Promise.all(docs.map((doc, i) => uploadDoc(providerId, doc, i)));
  const { data, error } = await supabase
    .from('provider_verifications')
    .insert({ provider_id: providerId, doc_urls: docUrls, status: 'pending' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function useSubmitVerification(providerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (docs: PickedDoc[]) => {
      if (!providerId) throw new Error('Not signed in');
      return submitVerification(providerId, docs);
    },
    onSuccess: (record) => {
      queryClient.setQueryData(['verification', record.provider_id], record);
    },
  });
}
```

- [ ] **Step 3: Install expo-file-system**

```bash
npx expo install expo-file-system
```

Expected: adds an SDK-57-compatible version to `package.json`/`package-lock.json`.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/api/verification.ts package.json package-lock.json
git commit -m "Add provider verification types and API layer"
```

---

### Task 3: Mobile — VerifyBusinessScreen, navigation, ProfileScreen status card

**Files:**
- Create: `src/screens/provider/VerifyBusinessScreen.tsx`
- Modify: `src/navigation/ProviderTabs.tsx`
- Modify: `src/screens/provider/ProfileScreen.tsx`
- Modify: `app.json`
- Modify: `package.json`, `package-lock.json` (installing `expo-image-picker`)

**Interfaces:**
- Consumes: `useLatestVerification`, `useSubmitVerification`, `PickedDoc` from Task 2's `src/api/verification.ts`; `Button`, `Screen`, `ScreenHeader` from `src/components/*`; `useSessionStore` from `src/store/useSessionStore.ts`.
- Produces: screen route name `VerifyBusiness` on the provider `ProfileStack`, navigable via `navigation.navigate('VerifyBusiness')`.

Note: `ProfileScreen`'s card (Step 4) already keeps a pending/approved provider from tapping through to this screen, but `VerifyBusinessScreen` re-checks the same status itself (Step 2) — it must not silently let a second submission through if it's ever reached another way (a stale back-stack entry, a deep link).

- [ ] **Step 0: Install expo-image-picker**

`expo-image-picker` is not yet a dependency of this project (an earlier
read of `package.json` that informed this plan's draft was against an
uncommitted, in-progress copy in another working directory — the actual
committed baseline this plan builds on doesn't have it). Install it the
same way Task 2 installed `expo-file-system`:

```bash
npx expo install expo-image-picker
```

Expected: adds an SDK-57-compatible version to `package.json`/`package-lock.json`.

- [ ] **Step 1: Add the expo-image-picker config plugin**

In `app.json`, add the `expo-image-picker` plugin to the existing `plugins`
array (its exact current contents may differ slightly from what's shown
below if unrelated plugins have been added elsewhere — preserve whatever
is already there and only add the `expo-image-picker` entry):

```json
    "plugins": ["expo-apple-authentication"],
```

to:

```json
    "plugins": [
      "expo-apple-authentication",
      "expo-notifications",
      [
        "expo-image-picker",
        {
          "photosPermission": "Solid Connect needs access to your photos so you can submit verification documents.",
          "microphonePermission": false
        }
      ]
    ],
```

- [ ] **Step 2: Write VerifyBusinessScreen**

Create `src/screens/provider/VerifyBusinessScreen.tsx`:

```tsx
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Camera, X } from 'lucide-react-native';
import { useLatestVerification, useSubmitVerification, type PickedDoc } from '../../api/verification';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

const MAX_PHOTOS = 3;

export function VerifyBusinessScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const [photos, setPhotos] = useState<PickedDoc[]>([]);
  const { data: verification } = useLatestVerification(profile?.id ?? null);
  const submit = useSubmitVerification(profile?.id ?? null);

  // Reached again with a submission already in flight (stale back-stack
  // entry, deep link) - show status instead of letting a second
  // concurrent submission through.
  if (verification?.status === 'pending' || verification?.status === 'approved') {
    return (
      <Screen>
        <ScreenHeader title="Verify your business" onBack={() => navigation.goBack()} />
        <View style={styles.statusWrap}>
          <Text style={styles.statusText}>
            {verification.status === 'pending'
              ? "Your documents are pending review. We'll update your profile once an admin has reviewed them."
              : "You're verified - no further action needed."}
          </Text>
        </View>
      </Screen>
    );
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access in Settings to submit verification documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhotos((prev) =>
      prev.length >= MAX_PHOTOS
        ? prev
        : [
            ...prev,
            {
              uri: asset.uri,
              fileName: asset.fileName ?? `doc-${Date.now()}.jpg`,
              mimeType: asset.type === 'image' ? 'image/jpeg' : 'application/octet-stream',
            },
          ]
    );
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function onSubmit() {
    try {
      await submit.mutateAsync(photos);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't submit", e instanceof Error ? e.message : 'Try again.');
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Verify your business" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>
          Add a photo of your government ID and, if you have one, your business certificate. An
          admin reviews these before your profile shows as verified.
        </Text>

        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.uri} style={styles.thumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
              <Pressable style={styles.removeBtn} onPress={() => removePhoto(photo.uri)} hitSlop={8}>
                <X size={12} strokeWidth={3} color={colors.white} />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable style={styles.addTile} onPress={pickPhoto}>
              <Camera size={20} strokeWidth={2} color={colors.inkFaint} />
              <Text style={styles.addLabel}>Add photo</Text>
            </Pressable>
          ) : null}
        </View>

        <Button
          title="Submit for review"
          onPress={onSubmit}
          disabled={photos.length === 0}
          loading={submit.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusWrap: { padding: spacing.lg },
  statusText: { fontSize: 14, fontFamily: fonts.medium, color: colors.inkMuted, lineHeight: 20 },
  body: { padding: spacing.lg, gap: spacing.xl },
  note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { width: 96, height: 96, borderRadius: radii.lg, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(21,24,26,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.card,
  },
  addLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.inkFaint },
});
```

- [ ] **Step 3: Register the screen in navigation**

In `src/navigation/ProviderTabs.tsx`, add the import after the `ServiceAreasScreen` import:

```typescript
import { VerifyBusinessScreen } from '../screens/provider/VerifyBusinessScreen';
```

Add the screen to `ProfileStack`, after the `ServiceAreas` screen entry:

```tsx
      <ProfileStackNav.Screen name="VerifyBusiness" component={VerifyBusinessScreen} />
```

- [ ] **Step 4: Add the status card to ProfileScreen**

In `src/screens/provider/ProfileScreen.tsx`, add the import:

```typescript
import { useLatestVerification } from '../../api/verification';
```

Add the hook call right after the existing `useProviderEarningsThisMonth` line:

```typescript
  const { data: verification } = useLatestVerification(profile?.id ?? null);
```

Add this block right after the badges block (the `{profile.provider_verified || profile.provider_certified ? (...) : null}` block) and before `<View style={styles.settingsCard}>`:

```tsx
        <Pressable
          style={styles.verifyCard}
          disabled={
            !!verification && (verification.status === 'pending' || verification.status === 'approved')
          }
          onPress={() => {
            const canSubmit = (!verification && !profile.provider_verified) || verification?.status === 'rejected';
            if (canSubmit) navigation.navigate('VerifyBusiness');
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.verifyTitle}>Business verification</Text>
            <Text style={styles.verifySubtitle}>
              {verification
                ? verification.status === 'pending'
                  ? 'Pending review'
                  : verification.status === 'approved'
                  ? 'Verified'
                  : `Rejected — ${verification.note ?? 'see admin note'}`
                : profile.provider_verified
                ? 'Verified'
                : 'Not submitted'}
            </Text>
          </View>
          {(!verification && !profile.provider_verified) || verification?.status === 'rejected' ? (
            <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
          ) : null}
        </Pressable>
```

Add these styles to the `styles` object, after `statRatingRow`:

```typescript
  verifyCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  verifyTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  verifySubtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, marginTop: 2 },
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app.json package.json package-lock.json src/screens/provider/VerifyBusinessScreen.tsx src/navigation/ProviderTabs.tsx src/screens/provider/ProfileScreen.tsx
git commit -m "Add provider verification submission screen"
```

**This task does not run the app.** The implementer has no way to launch
Expo, sign in, or reach the live Supabase project. Once Task 1's migration
is applied, the human owner runs this manual verification using the `/run`
skill (or `npx expo start`) against seed data, signed in as a seeded
unverified provider profile:

1. Open provider Profile — confirm the "Business verification" card reads "Not submitted" and is tappable.
2. Tap it, add 1-2 photos, tap "Submit for review" — confirm it navigates back and the card now reads "Pending review" and is no longer tappable.
3. Confirm in the Supabase dashboard (Table Editor) that a `provider_verifications` row exists with `status = 'pending'` and `doc_urls` pointing at real objects in the `verification-docs` bucket, and that the objects are visible under Storage.

---

### Task 4: Admin — Next.js scaffold, Supabase clients, login

**Files:**
- Create: `admin/package.json`
- Create: `admin/tsconfig.json`
- Create: `admin/next.config.ts`
- Create: `admin/next-env.d.ts`
- Create: `admin/postcss.config.js`
- Create: `admin/tailwind.config.ts`
- Create: `admin/.env.local.example`
- Create: `admin/app/globals.css`
- Create: `admin/app/layout.tsx`
- Create: `admin/lib/supabase/server.ts`
- Create: `admin/middleware.ts`
- Create: `admin/app/login/page.tsx`
- Create: `admin/app/login/actions.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars.
- Produces: `createClient()` async function in `admin/lib/supabase/server.ts` returning a request-scoped Supabase client — every later admin task imports this by this exact name/path. Route `/login` (public) and a working `signInAction(formData)` server action.

- [ ] **Step 1: Scaffold package.json**

Create `admin/package.json`:

```json
{
  "name": "admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.114.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Scaffold config files**

Create `admin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `admin/next-env.d.ts`:

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

Create `admin/next.config.ts`:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `admin/postcss.config.js`:

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Create `admin/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

Create `admin/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-never-expose-to-client
```

Create `admin/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Write the Supabase server client**

Create `admin/lib/supabase/server.ts`:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers - runs under RLS as whichever admin is signed in via the
 * session cookie. Do not use this for the approve/reject write: that needs
 * the service-role client (see admin/lib/supabase/service.ts, added in
 * Task 7) so it can update a row it doesn't own under RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that can't set cookies directly -
          // middleware.ts below refreshes the session on the next request.
        }
      },
    },
  });
}
```

`@supabase/ssr`'s `createServerClient` overload resolution doesn't
contextually type the inline `cookies` object's `setAll` under
TypeScript `strict: true` — the parameter comes back implicitly `any`
(`TS7006`) without an explicit annotation. Annotate it exactly as above.

- [ ] **Step 4: Write the session-refresh middleware**

Create `admin/middleware.ts`:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Revalidates the session token on every request so it doesn't silently
  // expire mid-session; the actual admin-or-not check lives in the
  // protected route group's layout (Task 5), not here.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 5: Write the root layout**

Create `admin/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Solid Connect Admin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Write the login page and sign-in action**

Create `admin/app/login/actions.ts`:

```typescript
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signInAction(formData: FormData) {
  const email = (formData.get('email') as string) ?? '';
  const password = (formData.get('password') as string) ?? '';

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect('/verifications');
}
```

Create `admin/app/login/page.tsx`:

```tsx
import { signInAction } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form action={signInAction} className="w-full max-w-sm rounded border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-lg font-semibold">Solid Connect Admin</h1>
        {error ? (
          <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === 'not_admin' ? 'That account is not an admin.' : error}
          </p>
        ) : null}
        <label className="mb-1 block text-sm text-gray-600">Email</label>
        <input name="email" type="email" required className="mb-4 w-full rounded border p-2" />
        <label className="mb-1 block text-sm text-gray-600">Password</label>
        <input name="password" type="password" required className="mb-6 w-full rounded border p-2" />
        <button type="submit" className="w-full rounded bg-gray-900 py-2 text-white">
          Sign in
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Install and build**

```bash
cd admin
npm install
npm run build
cd ..
```

Expected: install succeeds; `next build` completes (it will report `/login` as a route; `/verifications` doesn't exist yet, which is expected at this point).

- [ ] **Step 8: Commit**

```bash
git add admin
git commit -m "Scaffold admin Next.js app with Supabase auth and login"
```

**This task does not create real credentials or run `npm run dev` against
the live project.** The implementer has no Supabase credentials in this
session. Once Task 1's migration is applied, the human owner does this by
hand:

1. Copy `admin/.env.local.example` to `admin/.env.local` and fill in the real project URL/anon key/service-role key (from the Supabase dashboard's API settings).
2. In the Supabase dashboard, create an Auth user (Authentication → Users → Add user) with a real email/password, then run: `psql "$DATABASE_URL" -c "insert into public.admins (id, email) select id, email from auth.users where email = 'your-admin@example.com';"`
3. `cd admin && npm run dev`, open `http://localhost:3000/login`, sign in with that email/password.
4. Expected: redirected to `/verifications` (a 404 for now, since that route doesn't exist until Task 5 — a 404 rather than a login loop confirms the sign-in itself succeeded).

---

### Task 5: Admin — protected layout, nav shell, verification queue

**Files:**
- Create: `admin/components/nav.tsx`
- Create: `admin/app/(protected)/layout.tsx`
- Create: `admin/app/(protected)/verifications/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from Task 4's `admin/lib/supabase/server.ts`; `admins`, `provider_verifications`, `profiles` tables from Task 1.
- Produces: route `/verifications` listing submissions by status, linking to `/verifications/[id]` (built in Task 7).

- [ ] **Step 1: Write the nav shell**

Create `admin/components/nav.tsx`:

```tsx
import Link from 'next/link';

const ITEMS = [
  { label: 'Verifications', href: '/verifications', enabled: true },
  { label: 'Disputes', href: '#', enabled: false },
  { label: 'Analytics', href: '#', enabled: false },
  { label: 'Catalog', href: '#', enabled: false },
] as const;

export function Nav() {
  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 p-6">
      <div className="mb-8 text-lg font-semibold">Solid Connect Admin</div>
      <ul className="flex flex-col gap-1">
        {ITEMS.map((item) => (
          <li key={item.label}>
            {item.enabled ? (
              <Link href={item.href} className="block rounded px-3 py-2 text-sm hover:bg-gray-100">
                {item.label}
              </Link>
            ) : (
              <span className="block rounded px-3 py-2 text-sm text-gray-300">{item.label} (soon)</span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Write the protected layout (admin guard)**

Create `admin/app/(protected)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { createClient } from '@/lib/supabase/server';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) redirect('/login');

  // RLS on public.admins only lets a row be read by its own admin (see
  // is_admin() and the "admins can read the admin list" policy in
  // 0005_admin_verification.sql) - a signed-in non-admin gets zero rows
  // back here, which is exactly the signal used to reject them.
  const { data: adminRow } = await supabase.from('admins').select('id').eq('id', sub).maybeSingle();
  if (!adminRow) {
    await supabase.auth.signOut();
    redirect('/login?error=not_admin');
  }

  return (
    <div className="flex min-h-screen">
      <Nav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Write the verification queue page**

Create `admin/app/(protected)/verifications/page.tsx`:

```tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['pending', 'approved', 'rejected'] as const;

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: rawStatus } = await searchParams;
  const status = (STATUSES as readonly string[]).includes(rawStatus ?? '') ? (rawStatus as (typeof STATUSES)[number]) : 'pending';

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('provider_verifications')
    .select('id, provider_id, status, submitted_at')
    .eq('status', status)
    .order('submitted_at', { ascending: true });
  if (error) throw error;

  const providerIds = [...new Set((rows ?? []).map((r) => r.provider_id))];
  const { data: profiles } = providerIds.length
    ? await supabase.from('profiles').select('id, full_name, provider_category').in('id', providerIds)
    : { data: [] as { id: string; full_name: string; provider_category: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-1 text-xl font-semibold">Provider verifications</h1>
      <p className="mb-6 text-sm text-gray-500">
        {rows?.length ?? 0} {status}
      </p>

      <div className="mb-6 flex gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/verifications?status=${s}`}
            className={`rounded border px-3 py-1 ${status === s ? 'bg-gray-900 text-white' : 'text-gray-600'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {(rows ?? []).length === 0 ? (
        <p className="text-sm text-gray-500">No {status} submissions.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border">
          {(rows ?? []).map((r) => {
            const profile = profileById.get(r.provider_id);
            return (
              <li key={r.id}>
                <Link href={`/verifications/${r.id}`} className="flex justify-between px-4 py-3 hover:bg-gray-50">
                  <span>{profile?.full_name ?? 'Unknown provider'}</span>
                  <span className="text-gray-500">{profile?.provider_category}</span>
                  <span className="text-sm text-gray-400">{new Date(r.submitted_at).toLocaleDateString()}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Build**

```bash
cd admin && npm run build && cd ..
```

Expected: succeeds, now listing `/verifications` as a route (linking to `/verifications/[id]`, which 404s until Task 7 — expected at this point).

- [ ] **Step 5: Commit**

```bash
git add admin
git commit -m "Add admin nav shell and provider verification queue"
```

**This task does not run `npm run dev` or sign in.** Once Task 1's
migration is applied and Task 4's admin account exists, the human owner
verifies by hand:

1. `cd admin && npm run dev`, sign in as the admin created in Task 4.
2. Expected: lands on `/verifications`, shows the nav shell (Verifications active, Disputes/Analytics/Catalog greyed out "(soon)"), and shows the pending row submitted from Task 3's mobile run-through (provider name + category + submitted date).
3. Click the "approved"/"rejected" tabs — expected: empty state ("No approved submissions." / "No rejected submissions.").

---

### Task 6: Admin — review-verification logic (TDD)

**Files:**
- Create: `admin/lib/verification-repo.ts`
- Create: `admin/lib/types.ts`
- Create: `admin/lib/review-verification.ts`
- Create: `admin/lib/review-verification.test.ts`
- Modify: `admin/package.json`

**Interfaces:**
- Consumes: nothing (pure logic, no Supabase dependency).
- Produces: `VerificationRepo` interface and `VerificationRecord` type; `approveVerification(repo, id, adminId)` and `rejectVerification(repo, id, adminId, note)`, both returning `Promise<{ ok: true } | { ok: false; error: 'not_found' | 'already_reviewed' | 'missing_reason' }>`. Task 7's Supabase-backed repo implements `VerificationRepo`; Task 7's server actions call these two functions by these exact names/signatures.

- [ ] **Step 1: Add Vitest**

In `admin/package.json`, add to `"scripts"`:

```json
    "test": "vitest run"
```

Add to `"devDependencies"`:

```json
    "vitest": "^2.1.4"
```

```bash
cd admin && npm install && cd ..
```

- [ ] **Step 2: Define the repo interface**

Create `admin/lib/verification-repo.ts`:

```typescript
import type { VerificationStatus } from './types';

export interface VerificationRecord {
  id: string;
  providerId: string;
  status: VerificationStatus;
}

export interface VerificationRepo {
  getById(id: string): Promise<VerificationRecord | null>;
  markApproved(id: string, adminId: string): Promise<void>;
  markRejected(id: string, adminId: string, note: string): Promise<void>;
  setProviderVerified(providerId: string): Promise<void>;
}
```

Create `admin/lib/types.ts`:

```typescript
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
```

- [ ] **Step 3: Write the failing tests**

Create `admin/lib/review-verification.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { approveVerification, rejectVerification } from './review-verification';
import type { VerificationRecord, VerificationRepo } from './verification-repo';

class FakeVerificationRepo implements VerificationRepo {
  records = new Map<string, VerificationRecord>();
  providerVerified = new Set<string>();
  reviews: { id: string; adminId: string; status: string; note?: string }[] = [];

  seed(record: VerificationRecord) {
    this.records.set(record.id, record);
  }

  async getById(id: string) {
    return this.records.get(id) ?? null;
  }

  async markApproved(id: string, adminId: string) {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, status: 'approved' });
    this.reviews.push({ id, adminId, status: 'approved' });
  }

  async markRejected(id: string, adminId: string, note: string) {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, status: 'rejected' });
    this.reviews.push({ id, adminId, status: 'rejected', note });
  }

  async setProviderVerified(providerId: string) {
    this.providerVerified.add(providerId);
  }
}

describe('approveVerification', () => {
  it('approves a pending submission and marks the provider verified', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'pending' });

    const result = await approveVerification(repo, 'v1', 'admin-1');

    expect(result).toEqual({ ok: true });
    expect(repo.records.get('v1')?.status).toBe('approved');
    expect(repo.providerVerified.has('p1')).toBe(true);
  });

  it('rejects approving a submission that is not pending', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'approved' });

    const result = await approveVerification(repo, 'v1', 'admin-1');

    expect(result).toEqual({ ok: false, error: 'already_reviewed' });
    expect(repo.providerVerified.has('p1')).toBe(false);
  });

  it('returns not_found for a missing submission', async () => {
    const repo = new FakeVerificationRepo();
    const result = await approveVerification(repo, 'missing', 'admin-1');
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('rejectVerification', () => {
  it('rejects a pending submission with a reason', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'pending' });

    const result = await rejectVerification(repo, 'v1', 'admin-1', 'Blurry ID photo');

    expect(result).toEqual({ ok: true });
    expect(repo.records.get('v1')?.status).toBe('rejected');
    expect(repo.reviews[0]).toMatchObject({ status: 'rejected', note: 'Blurry ID photo' });
  });

  it('requires a non-empty reason', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'pending' });

    const result = await rejectVerification(repo, 'v1', 'admin-1', '   ');

    expect(result).toEqual({ ok: false, error: 'missing_reason' });
  });

  it('blocks rejecting an already-reviewed submission', async () => {
    const repo = new FakeVerificationRepo();
    repo.seed({ id: 'v1', providerId: 'p1', status: 'rejected' });

    const result = await rejectVerification(repo, 'v1', 'admin-1', 'reason');

    expect(result).toEqual({ ok: false, error: 'already_reviewed' });
  });
});
```

- [ ] **Step 4: Run the tests, confirm they fail**

```bash
cd admin && npm test && cd ..
```

Expected: FAIL — `review-verification.ts` doesn't exist yet (`Cannot find module './review-verification'`).

- [ ] **Step 5: Implement the logic**

Create `admin/lib/review-verification.ts`:

```typescript
import type { VerificationRepo } from './verification-repo';

export type ReviewError = 'not_found' | 'already_reviewed' | 'missing_reason';
export type ReviewResult = { ok: true } | { ok: false; error: ReviewError };

export async function approveVerification(repo: VerificationRepo, id: string, adminId: string): Promise<ReviewResult> {
  const record = await repo.getById(id);
  if (!record) return { ok: false, error: 'not_found' };
  if (record.status !== 'pending') return { ok: false, error: 'already_reviewed' };
  await repo.markApproved(id, adminId);
  await repo.setProviderVerified(record.providerId);
  return { ok: true };
}

export async function rejectVerification(
  repo: VerificationRepo,
  id: string,
  adminId: string,
  note: string
): Promise<ReviewResult> {
  if (!note.trim()) return { ok: false, error: 'missing_reason' };
  const record = await repo.getById(id);
  if (!record) return { ok: false, error: 'not_found' };
  if (record.status !== 'pending') return { ok: false, error: 'already_reviewed' };
  await repo.markRejected(id, adminId, note.trim());
  return { ok: true };
}
```

- [ ] **Step 6: Run the tests, confirm they pass**

```bash
cd admin && npm test && cd ..
```

Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add admin
git commit -m "Add tested approve/reject verification logic"
```

---

### Task 7: Admin — Supabase-backed repo, detail page, server actions

**Files:**
- Create: `admin/lib/supabase/service.ts`
- Create: `admin/lib/supabase-verification-repo.ts`
- Create: `admin/app/(protected)/verifications/[id]/actions.ts`
- Create: `admin/app/(protected)/verifications/[id]/page.tsx`

**Interfaces:**
- Consumes: `VerificationRepo` from Task 6's `admin/lib/verification-repo.ts`; `approveVerification`/`rejectVerification` from Task 6's `admin/lib/review-verification.ts`; `createClient()` from Task 4's `admin/lib/supabase/server.ts`.
- Produces: route `/verifications/[id]` with working Approve/Reject forms; `createServiceClient()` in `admin/lib/supabase/service.ts` (service-role, server-only — no later task should import this into anything that runs in the browser).

- [ ] **Step 1: Write the service-role client**

Create `admin/lib/supabase/service.ts`:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client - bypasses RLS. Server-only: SUPABASE_SERVICE_ROLE_KEY
 * has no NEXT_PUBLIC_ prefix, so Next.js never bundles it to the browser.
 * Only ever call this from a Server Action or Route Handler, never from a
 * Client Component.
 */
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 2: Implement VerificationRepo against Supabase**

Create `admin/lib/supabase-verification-repo.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerificationRecord, VerificationRepo } from './verification-repo';

export class SupabaseVerificationRepo implements VerificationRepo {
  constructor(private client: SupabaseClient) {}

  async getById(id: string): Promise<VerificationRecord | null> {
    const { data, error } = await this.client.from('provider_verifications').select('id, provider_id, status').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, providerId: data.provider_id, status: data.status };
  }

  async markApproved(id: string, adminId: string): Promise<void> {
    const { error } = await this.client
      .from('provider_verifications')
      .update({ status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async markRejected(id: string, adminId: string, note: string): Promise<void> {
    const { error } = await this.client
      .from('provider_verifications')
      .update({ status: 'rejected', reviewed_by: adminId, reviewed_at: new Date().toISOString(), note })
      .eq('id', id);
    if (error) throw error;
  }

  async setProviderVerified(providerId: string): Promise<void> {
    const { error } = await this.client.from('profiles').update({ provider_verified: true }).eq('id', providerId);
    if (error) throw error;
  }
}
```

- [ ] **Step 3: Write the server actions**

Create `admin/app/(protected)/verifications/[id]/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { approveVerification, rejectVerification } from '@/lib/review-verification';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SupabaseVerificationRepo } from '@/lib/supabase-verification-repo';

async function currentAdminId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) throw new Error('Not signed in');
  return sub;
}

export async function approveAction(formData: FormData) {
  const id = formData.get('id') as string;
  const adminId = await currentAdminId();
  const repo = new SupabaseVerificationRepo(createServiceClient());
  const result = await approveVerification(repo, id, adminId);
  if (!result.ok) throw new Error(result.error);
  revalidatePath('/verifications');
  redirect('/verifications');
}

export async function rejectAction(formData: FormData) {
  const id = formData.get('id') as string;
  const note = (formData.get('note') as string) ?? '';
  const adminId = await currentAdminId();
  const repo = new SupabaseVerificationRepo(createServiceClient());
  const result = await rejectVerification(repo, id, adminId, note);
  if (!result.ok) throw new Error(result.error);
  revalidatePath('/verifications');
  redirect('/verifications');
}
```

- [ ] **Step 4: Write the detail page**

Create `admin/app/(protected)/verifications/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { approveAction, rejectAction } from './actions';

export default async function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: verification, error } = await supabase
    .from('provider_verifications')
    .select('id, provider_id, status, doc_urls, note, submitted_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!verification) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, provider_category, area, phone, email')
    .eq('id', verification.provider_id)
    .maybeSingle();

  const { data: signedUrls } = await supabase.storage.from('verification-docs').createSignedUrls(verification.doc_urls, 60 * 10);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">{profile?.full_name ?? 'Unknown provider'}</h1>
      <p className="text-sm text-gray-500">
        {profile?.provider_category} · {profile?.area}
      </p>
      <p className="text-sm text-gray-500">
        {profile?.phone} · {profile?.email}
      </p>
      <p className="mt-2 text-sm uppercase tracking-wide text-gray-400">{verification.status}</p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {(signedUrls ?? []).map((u, i) =>
          // eslint-disable-next-line @next/next/no-img-element
          u.signedUrl ? <img key={i} src={u.signedUrl} alt={`Document ${i + 1}`} className="rounded border" /> : null
        )}
      </div>

      {verification.status === 'pending' ? (
        <div className="mt-8 flex flex-col gap-4">
          <form action={approveAction}>
            <input type="hidden" name="id" value={verification.id} />
            <button type="submit" className="rounded bg-emerald-700 px-4 py-2 text-white">
              Approve
            </button>
          </form>
          <form action={rejectAction} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={verification.id} />
            <textarea name="note" required placeholder="Reason for rejection" className="rounded border p-2" />
            <button type="submit" className="self-start rounded bg-red-700 px-4 py-2 text-white">
              Reject
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-8 text-sm text-gray-600">
          Already {verification.status}
          {verification.note ? ` — ${verification.note}` : ''}.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Build**

```bash
cd admin && npm run build && cd ..
```

Expected: succeeds, `/verifications/[id]` now a real route.

- [ ] **Step 6: Manual end-to-end verification**

1. `cd admin && npm run dev`, sign in as the admin, open `/verifications`, click into the pending submission from Task 3.
2. Expected: shows the provider's name/category/area/contact info and the uploaded document photo(s) rendered from signed URLs.
3. Click Reject without typing a reason — expected: browser blocks the empty submit (the `required` textarea).
4. Type a reason, click Reject — expected: redirected to `/verifications` (pending list now empty); the row now appears under the "rejected" tab.
5. On the mobile app (Task 3's screen, same provider), pull the Profile screen again — expected: the status card now reads "Rejected — {your reason}" and is tappable again to resubmit.
6. Resubmit from mobile, then in the admin app click into the new pending row and click Approve — expected: redirected to `/verifications`, pending list empty again; in the Supabase dashboard, `profiles.provider_verified` is now `true` for that provider.
7. On mobile, reload Profile — expected: the status card now reads "Verified".
8. Re-open the same (now approved) submission's URL directly (`/verifications/<id>`) — expected: shows "Already approved." with no Approve/Reject forms (proves the pending-only guard holds even via a stale link).

- [ ] **Step 7: Commit**

```bash
git add admin
git commit -m "Wire admin verification review to Supabase with approve/reject actions"
```
