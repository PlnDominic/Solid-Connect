# UI Consistency Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the concrete UI bugs and consistency gaps found in the 2026-09-11 UI audit of the Solid-Connect mobile app (Expo/React Native) and admin dashboard (Next.js), and establish shared patterns (one card-elevation token, one admin theme hook) so the same class of drift doesn't reappear screen-by-screen.

**Architecture:** No new subsystems. Each task is a targeted fix inside existing files, following patterns already established elsewhere in the same codebase (e.g. the `colors.ink`/`colors.paper` pairing already used correctly on `HomeScreen.tsx`'s CTA, or `FeedScreen.tsx`'s loading/error/empty branching). Tasks 4-5 introduce one new shared value (`shadow.card` in `src/theme/index.ts`) and one new shared hook (`useAdminTheme` in `admin/`) to remove duplicated logic; no other new abstractions.

**Tech Stack:** Expo / React Native (TypeScript) for the mobile app under `src/`; Next.js 15 App Router + plain CSS custom properties for the admin dashboard under `admin/`. No test runner is configured in either project (`package.json` has no `test` script and there are no `*.test.*` files), so every task's "test" step is a `grep`-based regression check plus a manual visual check in the running app via the **run** skill, in both light and dark theme where relevant.

**Spec:** No separate spec document — this plan implements the findings from a UI audit conducted directly in conversation on 2026-09-11 (not run through the brainstorming flow, since the findings were already concrete and enumerated). The relevant finding is quoted at the top of each task below.

## Global Constraints

- Never hardcode `colors.white` or `colors.black` as a background/foreground pair without checking what it sits on: `colors.ink` and `colors.paper` are the two tokens that actually flip between light/dark (`src/theme/ThemeProvider.tsx`); `colors.white`/`colors.black` are fixed in both palettes.
- The established "elevated card" pattern in this codebase (introduced this session) is: no border, `backgroundColor: colors.card`, plus a shadow — never both a border and a shadow on the same container (this is also what `src/theme/index.ts`'s own doc comment already asks for).
- Where a card has internal row dividers and rounded corners, split it into an outer `View` (radius + background + shadow) wrapping an inner `View` (radius + `overflow: 'hidden'`) — putting `overflow: 'hidden'` on the same view as the shadow clips the shadow away on iOS.
- Every icon-only `Pressable` needs `accessibilityRole="button"` and an `accessibilityLabel` describing the action, and should have `hitSlop` bringing its effective tap target to at least 40×40.
- Run `expo start` via the **run** skill to visually verify UI changes in the actual app; toggle the in-app **Appearance** screen (Profile → Appearance) to check both light and dark theme where a task touches theming.
- Commit after each task (or each file within a task, where noted) with a message describing the concrete fix, not the audit category.

---

### Task 1: Fix `Button.tsx` primary-variant dark-mode contrast bug

**Finding:** *"`src/components/Button.tsx:50,52,68` — the default (primary) button variant sets `backgroundColor: colors.ink` and text/spinner color to hardcoded `colors.white`. In dark mode `colors.ink` resolves to `#F2F2F1` (near-white), so every default-variant `<Button>` (39 usages across 21 screens) renders near-white text on a near-white background."*

This is the same bug class already fixed on `HomeScreen.tsx`'s hero CTA earlier this session (pairing an ink-colored fill with a `colors.paper`-colored label instead of a hardcoded white one) — `Button.tsx` itself never got that fix, so every other screen using the default button variant still has it.

**Files:**
- Modify: `src/components/Button.tsx`

**Interfaces:**
- Consumes: `useTheme()` from `src/theme/ThemeProvider.tsx` (`colors.ink`, `colors.paper`, `colors.white`, `colors.navy`, `colors.black`) — no changes to that hook.
- Produces: no exported signature changes — `Button`'s props (`title`, `onPress`, `variant`, `disabled`, `loading`, `style`) are unchanged, so every call site keeps working with no edits needed there.

- [ ] **Step 1: Read the current file to confirm line numbers before editing**

Run:
```bash
grep -n "isFilled ? colors.white" "src/components/Button.tsx"
```
Expected output (two matches, the `ActivityIndicator` and the label `Text`):
```
50:        <ActivityIndicator color={isFilled ? colors.white : colors.ink} />
52:        <Text style={[styles.label, { color: isFilled ? colors.white : colors.ink }]}>{title}</Text>
```

- [ ] **Step 2: Fix the color logic so only the theme-invariant `navy` variant keeps hardcoded white, and the theme-relative `primary` variant pairs with `colors.paper`**

In `src/components/Button.tsx`, replace:
```tsx
      {loading ? (
        <ActivityIndicator color={isFilled ? colors.white : colors.ink} />
      ) : (
        <Text style={[styles.label, { color: isFilled ? colors.white : colors.ink }]}>{title}</Text>
      )}
```
with:
```tsx
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.paper : isFilled ? colors.white : colors.ink} />
      ) : (
        <Text style={[styles.label, { color: isPrimary ? colors.paper : isFilled ? colors.white : colors.ink }]}>
          {title}
        </Text>
      )}
```
(`isPrimary` is already computed above as `const isPrimary = variant === 'primary';` — no new variable needed. `isNavy`/`isFilled` are unaffected, so the `navy` variant — a permanently-dark background regardless of theme — keeps its hardcoded white text, which is correct since `colors.navy` is never overridden in `darkColors`.)

- [ ] **Step 3: Verify no other `colors.white`/`colors.ink` pairing was missed in this file**

Run:
```bash
grep -n "colors\.white\|colors\.ink\|colors\.paper" "src/components/Button.tsx"
```
Expected: the `outline`/`ghost` branches still use `colors.ink` (correct — their background is `colors.card`, which is theme-relative in the same direction as `colors.ink`'s text-color role), and the `primary` branch now reads `colors.paper`.

- [ ] **Step 4: Manually verify in the running app**

Using the **run** skill, launch the app, open any screen with a default-variant button (e.g. Requests → an active request with a quote → "Accept" button, or any onboarding screen's primary CTA). Toggle to dark mode via Profile → Appearance and confirm the button label is now visible (dark ink-colored button with light label in light mode; light ink-colored button with dark label in dark mode). Also check a `navy`-variant button (e.g. onboarding's Google/Apple sign-in screens) still shows white text on navy in both themes.

- [ ] **Step 5: Commit**

```bash
git add src/components/Button.tsx
git commit -m "fix(button): pair primary variant's ink fill with paper label so text stays visible in dark mode"
```

---

### Task 2: Fix hardcoded white backgrounds on Splash/AuthFlow screens

**Finding:** *"`src/screens/onboarding/SplashScreen.tsx:64,67` — background pinned to `colors.white` instead of `colors.paper`, and the caption color is a hardcoded literal `rgba(17,17,19,0.45)` instead of a theme token."* and *"`src/screens/onboarding/AuthFlowScreen.tsx:438-439` — `blank`/`errorWrap` screen backgrounds use `colors.white` instead of `colors.paper`, so these screens stay white even in dark mode while the rest of the auth flow (e.g. `SignInScreen.tsx:181`) correctly flips."*

**Files:**
- Modify: `src/screens/onboarding/SplashScreen.tsx`
- Modify: `src/screens/onboarding/AuthFlowScreen.tsx`

**Interfaces:**
- Consumes: `useTheme()` (`colors.paper`, `colors.inkFaint`, `scheme`) — `SplashScreen` already imports `useTheme`; no new imports needed beyond destructuring `scheme` too.
- Produces: no signature changes to either component.

- [ ] **Step 1: Fix `SplashScreen.tsx`'s background, caption color, and status bar style**

Read current relevant lines:
```tsx
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  ...
  return (
    <Animated.View style={[styles.fill, { opacity: screenOpacity }]}>
      <StatusBar style="dark" />
      ...

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.white },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
    logo: { width: 150, height: 84 },
    caption: { fontSize: 13, letterSpacing: 0.6, color: 'rgba(17,17,19,0.45)', fontFamily: fonts.medium },
  });
}
```

Replace with:
```tsx
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors);
  ...
  return (
    <Animated.View style={[styles.fill, { opacity: screenOpacity }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      ...

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.paper },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
    logo: { width: 150, height: 84 },
    caption: { fontSize: 13, letterSpacing: 0.6, color: colors.inkFaint, fontFamily: fonts.medium },
  });
}
```
(Only the destructured hook, the `StatusBar` prop, and the two flagged style values change — the animation logic in between is untouched.)

- [ ] **Step 2: Fix `AuthFlowScreen.tsx`'s `blank`/`errorWrap` backgrounds**

Replace:
```tsx
function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    blank: { flex: 1, backgroundColor: colors.white },
    errorWrap: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: 32 },
    errorText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center' },
  });
}
```
with:
```tsx
function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    blank: { flex: 1, backgroundColor: colors.paper },
    errorWrap: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 32 },
    errorText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center' },
  });
}
```

- [ ] **Step 3: Verify no stray hardcoded white/black remain in either file**

Run:
```bash
grep -n "colors\.white\|colors\.black\|rgba(17,17,19" "src/screens/onboarding/SplashScreen.tsx" "src/screens/onboarding/AuthFlowScreen.tsx"
```
Expected: no matches (both files should now only reference `colors.paper`/`colors.inkFaint`/`colors.ink`).

- [ ] **Step 4: Manually verify in the running app**

Using the **run** skill, force dark mode (Profile → Appearance → Dark, then relaunch to onboarding by signing out, or temporarily set the initial `scheme` state in `ThemeProvider.tsx` to `'dark'` for this check only and revert after) and confirm the splash screen and the auth flow's bootstrapping/error states render with a dark background and light caption/status-bar icons instead of staying white.

- [ ] **Step 5: Commit**

```bash
git add src/screens/onboarding/SplashScreen.tsx src/screens/onboarding/AuthFlowScreen.tsx
git commit -m "fix(onboarding): stop pinning splash/auth-flow backgrounds to white in dark mode"
```

---

### Task 3: Fix avatar circle off-by-2px bug on profile hero photos

**Finding:** *"`customer/ProfileScreen.tsx:246-256` and `provider/ProfileScreen.tsx` (same pattern) — the outer `heroAvatarWrap` is 72×72 with `borderRadius: 36` (correct half), but `heroAvatarImage` hardcodes `borderRadius: 34`, and the wrap has no `overflow: 'hidden'` to clip it — so the image's own corners are ~2px short of a true circle, visible as faint square-ish corners peeking past the ring."*

**Files:**
- Modify: `src/screens/customer/ProfileScreen.tsx`
- Modify: `src/screens/provider/ProfileScreen.tsx`

**Interfaces:** No signature changes — pure style fix in both files' `makeStyles`.

- [ ] **Step 1: Confirm current values in both files**

Run:
```bash
grep -n "heroAvatarWrap\|heroAvatarImage" "src/screens/customer/ProfileScreen.tsx" "src/screens/provider/ProfileScreen.tsx"
```
Expected (both files, values may differ slightly in surrounding properties but the radius/overflow gap is the same in both):
```
heroAvatarWrap: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
heroAvatarImage: { width: '100%', height: '100%', borderRadius: 34 },
```

- [ ] **Step 2: Add `overflow: 'hidden'` to `heroAvatarWrap` in `src/screens/customer/ProfileScreen.tsx`**

Replace:
```tsx
    heroAvatarWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    heroAvatarImage: { width: '100%', height: '100%', borderRadius: 34 },
```
with:
```tsx
    heroAvatarWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    heroAvatarImage: { width: '100%', height: '100%', borderRadius: 36 },
```
(`overflow: 'hidden'` clips the image to the wrap's own circle, and bumping the image's own radius to match `36` removes the redundant, mismatched inner radius rather than relying on clipping alone to hide the discrepancy.)

- [ ] **Step 3: Apply the identical fix to `src/screens/provider/ProfileScreen.tsx`**

Replace:
```tsx
    heroAvatarWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      overflow: 'visible',
    },
    heroAvatarImage: { width: '100%', height: '100%', borderRadius: 34 },
```
with:
```tsx
    heroAvatarWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    heroAvatarImage: { width: '100%', height: '100%', borderRadius: 36 },
```
(Note this file currently has `overflow: 'visible'`, not the customer file's absent property — check the actual current value with the Step 1 grep before editing, since the provider file was previously touched for a different reason and may already differ; if the camera badge disappears after this change because it relied on `overflow: 'visible'` to render outside the circle, see Step 4.)

- [ ] **Step 4: Confirm the camera badge still renders outside the circle**

The camera badge (`heroCameraBadge`, positioned via `position: 'absolute', bottom: -2, right: -2`) is a **sibling** of the `<Image>` inside `heroAvatarWrap`, not a child of the `<Image>` itself — check this with:
```bash
grep -n -A2 "heroAvatarWrap" "src/screens/provider/ProfileScreen.tsx" | grep -n "Pressable\|Image\|View"
```
Since `overflow: 'hidden'` on `heroAvatarWrap` will also clip the badge if the badge is a child of that same wrap. Read the JSX around the `heroAvatarWrap` Pressable in both files (`grep -n "heroAvatarWrap" -A 15 src/screens/customer/ProfileScreen.tsx`) — if `heroCameraBadge` is rendered as a child of the `Pressable style={styles.heroAvatarWrap}`, move the badge to be a sibling **outside** that `Pressable` instead (wrap both in a new plain `<View style={{ position: 'relative' }}>` if one doesn't already exist), so clipping the circle doesn't also clip the badge. Verify the exact current JSX structure before making this call — if the badge is already positioned relative to an outer wrapper that isn't clipped, no JSX change is needed here, only the style change from Steps 2-3.

- [ ] **Step 5: Manually verify in the running app**

Using the **run** skill, open Profile (as both a customer and a provider test account, or just the customer flow if only one test account exists) and zoom in on the hero avatar photo — the corners should now form a clean circle with no square peeking past the ring, and the camera badge should still be visible at the bottom-right of the circle.

- [ ] **Step 6: Commit**

```bash
git add src/screens/customer/ProfileScreen.tsx src/screens/provider/ProfileScreen.tsx
git commit -m "fix(profile): clip hero avatar photo to a true circle instead of a near-circle"
```

---

### Task 4: Introduce a shared `shadow.card` token and retrofit duplicated inline shadows to use it

**Finding (self-identified during planning, DRY violation):** Seven style blocks across five files hand-roll the exact same five-property shadow recipe (`shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: {width:0,height:5}, elevation: 3`, plus `shadowColor: colors.black`) instead of using the `shadow.card` token that already exists in `src/theme/index.ts` (currently zeroed out at `shadowOpacity: 0`, a leftover from before this session's card-elevation work started). This task makes the token real and removes the duplication; it changes no visual output.

**Files:**
- Modify: `src/theme/index.ts`
- Modify: `src/screens/customer/HomeScreen.tsx` (`categoryCard`, `providerListShadow`)
- Modify: `src/screens/customer/RequestsScreen.tsx` (`summary`)
- Modify: `src/screens/customer/JobDetailScreen.tsx` (`progressCard`, `detailsCard`)
- Modify: `src/screens/provider/JobDetailScreen.tsx` (`progressCard`)
- Modify: `src/screens/provider/RequestDetailScreen.tsx` (`summary`)

**Interfaces:**
- Produces: `shadow.card` — an object `{ shadowColor: string, shadowOpacity: number, shadowRadius: number, shadowOffset: { width: number, height: number }, elevation: number }`, importable as `import { shadow } from '../../theme'` (or `'../theme'` depending on file depth), spread into any style object as `...shadow.card`.
- Does **not** touch `shadow.sheet` (unrelated, reserved for modals/sheets), nor the visually-heavier one-off shadows on `HomeScreen.tsx`'s `heroCard` (0.14/20/10/6), `customer/ProviderDetailScreen.tsx`'s `cta` (0.16/16/6/4), or `Button.tsx`'s `primary`/`navy` (their own distinct values) — those are deliberately stronger for more prominent elements and are left as intentional one-offs, not folded into this token.

- [ ] **Step 1: Update the `shadow.card` token in `src/theme/index.ts`**

Read the current block to confirm line numbers:
```bash
grep -n -A7 "^export const shadow" "src/theme/index.ts"
```
Expected:
```ts
export const shadow = {
  // Reserved for genuinely floating layers only (sheets, modals) - in-flow
  // content separates with a hairline, never a shadow standing in for one.
  sheet: {
    shadowColor: '#0B0B0A',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  // Legacy alias for screens outside this pass's scope.
  card: {
    shadowColor: '#0B0B0A',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
};
```
Replace the `card` entry (and its now-inaccurate comment) with:
```ts
  // Standard elevated-card shadow: no border, shadow does the separating.
  // Used for any passive content card sitting directly on `paper`/`card`.
  card: {
    shadowColor: '#0B0B0A',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
```

- [ ] **Step 2: Retrofit `HomeScreen.tsx`'s `categoryCard` and `providerListShadow`**

Add `shadow` to the theme import:
```ts
import { fonts, radii, spacing } from '../../theme';
```
becomes:
```ts
import { fonts, radii, shadow, spacing } from '../../theme';
```

Replace:
```tsx
    categoryCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
```
with:
```tsx
    categoryCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
      ...shadow.card,
    },
```
and replace:
```tsx
    providerListShadow: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
```
with:
```tsx
    providerListShadow: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      ...shadow.card,
    },
```

- [ ] **Step 3: Retrofit `RequestsScreen.tsx`'s `summary`**

Add `shadow` to the theme import (same pattern as Step 2), then replace:
```tsx
    summary: {
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      gap: 3,
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
```
with:
```tsx
    summary: {
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      gap: 3,
      ...shadow.card,
    },
```

- [ ] **Step 4: Retrofit `customer/JobDetailScreen.tsx`'s `progressCard` and `detailsCard`**

Add `shadow` to the theme import, then replace:
```tsx
    progressCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.sm,
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
```
with:
```tsx
    progressCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadow.card,
    },
```
and replace:
```tsx
    detailsCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: 6,
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
```
with:
```tsx
    detailsCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: 6,
      ...shadow.card,
    },
```

- [ ] **Step 5: Retrofit `provider/JobDetailScreen.tsx`'s `progressCard`**

Add `shadow` to the theme import, then replace:
```tsx
    progressCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
```
with:
```tsx
    progressCard: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
```

- [ ] **Step 6: Retrofit `provider/RequestDetailScreen.tsx`'s `summary`**

Add `shadow` to the theme import, then replace:
```tsx
    summary: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
      gap: 3,
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
```
with:
```tsx
    summary: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.md,
      gap: 3,
      ...shadow.card,
    },
```

- [ ] **Step 7: Verify no visual regression — the six retrofitted blocks must be byte-identical in their resolved values**

Run:
```bash
grep -rn "shadowOpacity: 0.1,\s*$" src/screens/customer/HomeScreen.tsx src/screens/customer/RequestsScreen.tsx src/screens/customer/JobDetailScreen.tsx src/screens/provider/JobDetailScreen.tsx src/screens/provider/RequestDetailScreen.tsx
```
Expected: **no matches** (all six inline blocks are gone, replaced by `...shadow.card`). Then run:
```bash
grep -rn "\.\.\.shadow\.card" src/screens/customer/HomeScreen.tsx src/screens/customer/RequestsScreen.tsx src/screens/customer/JobDetailScreen.tsx src/screens/provider/JobDetailScreen.tsx src/screens/provider/RequestDetailScreen.tsx
```
Expected: exactly 7 matches (2 in `HomeScreen.tsx`, 1 each in the other four).

- [ ] **Step 8: Manually verify in the running app**

Using the **run** skill, open Home, Requests, both Job Detail screens (customer and provider), and the provider's Request Detail screen — none of these should look any different from before this task (this is a pure refactor). Confirm the shadows are still present and unchanged in both light and dark theme.

- [ ] **Step 9: Commit**

```bash
git add src/theme/index.ts src/screens/customer/HomeScreen.tsx src/screens/customer/RequestsScreen.tsx src/screens/customer/JobDetailScreen.tsx src/screens/provider/JobDetailScreen.tsx src/screens/provider/RequestDetailScreen.tsx
git commit -m "refactor(theme): make shadow.card the real elevated-card recipe, dedupe 6 inline copies"
```

---

### Task 5: Migrate remaining border-only / flat / double-treatment cards to `shadow.card`

**Finding:** *"Three distinct card treatments coexist for what is visually the same 'card' role: border-only (`ProfileScreen.tsx:284`, `provider/ProfileScreen.tsx:348,361`, `NotificationsScreen.tsx:76`, `HelpSupportScreen.tsx:49,55`, `PayoutDetailsScreen.tsx:57`, `AppearanceScreen.tsx:52-58`); shadow-only (everything fixed this session); neither border nor shadow (`ReviewCard.tsx:32-37`); both border and shadow combined (`TabBar.tsx:72-85`), which the theme file's own doc-comment says should be mutually exclusive."*

This task converts every remaining "border-only" and "flat" card to the now-real `shadow.card` token from Task 4, and removes `TabBar.tsx`'s redundant border. Depends on Task 4 being done first (needs the real token).

**Files:**
- Modify: `src/components/ReviewCard.tsx`
- Modify: `src/screens/customer/ProfileScreen.tsx` (`statement`)
- Modify: `src/screens/provider/ProfileScreen.tsx` (`statement`, `distCard`)
- Modify: `src/screens/shared/NotificationsScreen.tsx` (`card`)
- Modify: `src/screens/shared/HelpSupportScreen.tsx` (`card`, `faqCard`)
- Modify: `src/screens/provider/PayoutDetailsScreen.tsx` (`card` — **not** `balanceCard`, which is an intentional navy accent card and stays as-is)
- Modify: `src/screens/shared/AppearanceScreen.tsx` (`card`)
- Modify: `src/screens/customer/HomeScreen.tsx` (`filterEmpty` — found during Task 4 verification, same border-only pattern, not in the original audit list but the same fix applies)
- Modify: `src/navigation/TabBar.tsx` (drop border, keep its own existing shadow)

**Interfaces:**
- Consumes: `shadow.card` from Task 4.
- Six of these files (`customer/ProfileScreen.tsx`, `provider/ProfileScreen.tsx`, `NotificationsScreen.tsx`, `HelpSupportScreen.tsx`'s `card`, `PayoutDetailsScreen.tsx`, `AppearanceScreen.tsx`) currently rely on `overflow: 'hidden'` on the card itself to clip internal row dividers to the rounded corners — per the Global Constraints, these need the **outer-wrapper + inner-overflow-hidden** split, which means a small JSX change (one new wrapping `<View>`) in addition to the style change. `HelpSupportScreen.tsx`'s `faqCard` and `provider/ProfileScreen.tsx`'s `distCard` have no `overflow: 'hidden'` and no internal dividers, so they're a straight style swap with no JSX change.

- [ ] **Step 1: `ReviewCard.tsx` — add the shadow (currently has neither border nor shadow)**

Add `shadow` to the theme import:
```tsx
import { fonts, radii, spacing } from '../theme';
```
becomes:
```tsx
import { fonts, radii, shadow, spacing } from '../theme';
```
Replace:
```tsx
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.sm,
    },
```
with:
```tsx
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadow.card,
    },
```
No JSX change needed — `ReviewCard`'s root `<View style={styles.card}>` has no internal `overflow: 'hidden'` requirement (there's no row-divider content inside it).

- [ ] **Step 2: `customer/ProfileScreen.tsx` — convert `statement` (has internal dividers, needs the wrapper split)**

Read the current JSX around the statement card:
```bash
grep -n -B2 -A12 "styles.statement}" "src/screens/customer/ProfileScreen.tsx"
```
Expected (from the audit read):
```tsx
          <View style={styles.statement}>
            <View style={styles.statementRow}>
              <Text style={styles.statementLabel}>Jobs posted</Text>
              <Text style={styles.statementValueLg}>{jobsCount}</Text>
            </View>
            <View style={[styles.statementRow, styles.statementRowBorder]}>
              <Text style={styles.statementLabel}>Saved providers</Text>
              <Text style={styles.statementValue}>{saved.length}</Text>
            </View>
          </View>
```
Replace with a two-level wrapper:
```tsx
          <View style={styles.statementShadow}>
          <View style={styles.statement}>
            <View style={styles.statementRow}>
              <Text style={styles.statementLabel}>Jobs posted</Text>
              <Text style={styles.statementValueLg}>{jobsCount}</Text>
            </View>
            <View style={[styles.statementRow, styles.statementRowBorder]}>
              <Text style={styles.statementLabel}>Saved providers</Text>
              <Text style={styles.statementValue}>{saved.length}</Text>
            </View>
          </View>
          </View>
```
Add `shadow` to the theme import, then replace:
```tsx
    statement: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
```
with:
```tsx
    statementShadow: { borderRadius: radii.lg, backgroundColor: colors.card, ...shadow.card },
    statement: { borderRadius: radii.lg, overflow: 'hidden' },
```

- [ ] **Step 3: `provider/ProfileScreen.tsx` — apply the identical `statement` fix, plus a plain swap for `distCard`**

Repeat Step 2's exact JSX-wrapping and style change in `src/screens/provider/ProfileScreen.tsx` (confirm its `statement` JSX block with `grep -n -B2 -A12 "styles.statement}" "src/screens/provider/ProfileScreen.tsx"` first — it should match the customer version).

Then, for `distCard` (no internal dividers, no `overflow: 'hidden'` — straight swap), replace:
```tsx
    distCard: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.md, gap: 7 },
```
with:
```tsx
    distCard: { borderRadius: radii.lg, backgroundColor: colors.card, padding: spacing.md, gap: 7, ...shadow.card },
```

- [ ] **Step 4: `NotificationsScreen.tsx` — wrapper split for `card`**

Read the JSX:
```bash
grep -n -B2 -A15 "styles.card}" "src/screens/shared/NotificationsScreen.tsx"
```
Wrap the single `<View style={styles.card}>` (found at line 52 per the audit) the same way as Step 2 — rename the existing usage site to `styles.cardShadow` on a new outer `<View>`, keep the inner `<View style={styles.card}>` for the mapped rows. Add `shadow` to the theme import, then replace:
```tsx
    card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
```
with:
```tsx
    cardShadow: { borderRadius: radii.lg, backgroundColor: colors.card, ...shadow.card },
    card: { borderRadius: radii.lg, overflow: 'hidden' },
```

- [ ] **Step 5: `HelpSupportScreen.tsx` — wrapper split for `card`, plain swap for `faqCard`**

For the contact-info `card` (line 20's `<View style={styles.card}>`), apply the same wrapper split as Step 4: introduce `cardShadow` on a new outer `<View>`, keep `card` on the inner one with just `overflow: 'hidden'`.

For `faqCard` (no dividers, straight swap), replace:
```tsx
    faqCard: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.card, padding: spacing.md, gap: 6 },
```
with:
```tsx
    faqCard: { borderRadius: radii.lg, backgroundColor: colors.card, padding: spacing.md, gap: 6, ...shadow.card },
```
Add `shadow` to the theme import.

- [ ] **Step 6: `PayoutDetailsScreen.tsx` — wrapper split for `card` only (leave `balanceCard` untouched)**

Read the JSX around line 25's `<View style={styles.card}>` and apply the same wrapper split as Step 4. Add `shadow` to the theme import, then replace:
```tsx
    card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
```
with:
```tsx
    cardShadow: { borderRadius: radii.lg, backgroundColor: colors.card, ...shadow.card },
    card: { borderRadius: radii.lg, overflow: 'hidden' },
```
Do **not** touch `balanceCard` (`borderRadius: radii.xxl, backgroundColor: colors.navy, padding: spacing.xl, gap: 6`) — that's a deliberate navy-filled feature card, not part of this consistency pass.

- [ ] **Step 7: `AppearanceScreen.tsx` — wrapper split for `card`**

Read the JSX around line 22's `<View style={styles.card}>` and apply the same wrapper split. Add `shadow` to the theme import, then replace:
```tsx
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.hairline,
      overflow: 'hidden',
    },
```
with:
```tsx
    cardShadow: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      ...shadow.card,
    },
    card: {
      borderRadius: radii.lg,
      overflow: 'hidden',
    },
```

- [ ] **Step 8: `HomeScreen.tsx` — convert `filterEmpty` (found during Task 4's verification pass, same pattern)**

Add `shadow` to the theme import if not already present from Task 4. Replace:
```tsx
    filterEmpty: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
```
with:
```tsx
    filterEmpty: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      paddingVertical: spacing.xxl,
      alignItems: 'center',
      ...shadow.card,
    },
```
(No JSX wrapper needed — `filterEmpty` has no internal dividers.)

- [ ] **Step 9: `TabBar.tsx` — remove the redundant border, keep its own existing shadow**

Read current `bar` style:
```bash
grep -n -A13 "^\s*bar: {" "src/navigation/TabBar.tsx"
```
Expected:
```tsx
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      shadowColor: colors.black,
      shadowOpacity: 0.07,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 12,
    },
```
Replace with (drop the two border lines, keep everything else exactly as-is — this bar's shadow is its own distinct recipe tuned for a floating pill, not `shadow.card`):
```tsx
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.card,
      shadowColor: colors.black,
      shadowOpacity: 0.07,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 12,
    },
```

- [ ] **Step 10: Verify no more border-only card patterns remain among the flagged files**

Run:
```bash
grep -n "borderWidth: 1, borderColor: colors.hairline" src/components/ReviewCard.tsx src/screens/customer/ProfileScreen.tsx src/screens/provider/ProfileScreen.tsx src/screens/shared/NotificationsScreen.tsx src/screens/shared/HelpSupportScreen.tsx src/screens/provider/PayoutDetailsScreen.tsx src/screens/shared/AppearanceScreen.tsx src/screens/customer/HomeScreen.tsx
```
Expected: no matches on any of the card styles touched above (other, unrelated `borderWidth: 1` usages like input fields or divider lines elsewhere in these files are fine and out of scope — only confirm the specific `card`/`statement`/`distCard`/`faqCard`/`filterEmpty` blocks changed).

- [ ] **Step 11: Manually verify in the running app**

Using the **run** skill, visit: Profile (both customer and provider, check the "statement" stat card), Saved Providers (via a review card if visible, or check the reviews tab on Provider Detail), Notifications, Help & Support, Payout Details (provider), Appearance, and Home's "no providers match this filter" empty state. Confirm every one of these now shows a shadow-elevated card with no border line, in both light and dark theme, and that the internal row dividers (statement rows, notification rows, contact rows) still render correctly with rounded outer corners.

- [ ] **Step 12: Commit**

```bash
git add src/components/ReviewCard.tsx src/screens/customer/ProfileScreen.tsx src/screens/provider/ProfileScreen.tsx src/screens/shared/NotificationsScreen.tsx src/screens/shared/HelpSupportScreen.tsx src/screens/provider/PayoutDetailsScreen.tsx src/screens/shared/AppearanceScreen.tsx src/screens/customer/HomeScreen.tsx src/navigation/TabBar.tsx
git commit -m "style: migrate remaining border-only/flat cards to the shadow-only elevation pattern"
```

---

### Task 6: Add loading-state guards to screens missing them

**Finding:** *"`HomeScreen.tsx`, `AllProvidersScreen.tsx`, both `JobsScreen.tsx`, `RequestsScreen.tsx`, `ChatListScreen.tsx` all destructure query data with a `= []` fallback but never check `isLoading` — the empty state can flash during the initial fetch, indistinguishable from a genuinely empty result. `ChatThreadScreen.tsx` has no loading indicator and no empty state at all. `provider/FeedScreen.tsx:24,45-56` does this correctly (loading/error/empty as three distinct branches) — proof the gap elsewhere is inconsistency, not a deliberate call."*

**Files:**
- Modify: `src/screens/customer/HomeScreen.tsx`
- Modify: `src/screens/customer/AllProvidersScreen.tsx`
- Modify: `src/screens/customer/JobsScreen.tsx`
- Modify: `src/screens/provider/JobsScreen.tsx`
- Modify: `src/screens/customer/RequestsScreen.tsx`
- Modify: `src/screens/shared/ChatListScreen.tsx`
- Modify: `src/screens/shared/ChatThreadScreen.tsx`

**Interfaces:**
- Consumes: the existing react-query hooks in each file already return `isLoading` (or `isPending` for newer TanStack Query versions — check which one `src/api/*.ts` hooks are built on by running `grep -n "useQuery\|isPending\|isLoading" src/api/marketplace.ts | head -5` before writing each step, so the exact flag name matches what the hook actually returns).
- Produces: no new exports — each screen gains a loading branch rendered before its existing empty/content branches.

- [ ] **Step 1: Confirm which flag TanStack Query returns in this codebase**

Run:
```bash
grep -n "from '@tanstack/react-query'" package.json
cat package.json | grep '"@tanstack/react-query"'
```
If the installed version is v5+, the hooks expose both `isPending` and `isLoading` (with slightly different semantics for disabled queries) — use whichever one `provider/FeedScreen.tsx` already uses, for consistency:
```bash
grep -n "isLoading\|isPending" "src/screens/provider/FeedScreen.tsx"
```
Use that exact same flag name in every step below.

- [ ] **Step 2: `HomeScreen.tsx` — add a loading guard around the provider list**

Read the current destructuring and empty-state JSX:
```tsx
  const { data: providers = [], refetch: refetchProviders } = useAllProviders(null, profile?.area ?? null);
  ...
        {filteredProviders.length === 0 ? (
          <View style={styles.filterEmpty}>
            <Text style={styles.filterEmptyText}>No providers match this filter right now.</Text>
          </View>
        ) : (
```
Change the destructuring to also pull the loading flag:
```tsx
  const { data: providers = [], isLoading: providersLoading, refetch: refetchProviders } = useAllProviders(null, profile?.area ?? null);
```
Change the render branch to a three-way split:
```tsx
        {providersLoading ? (
          <View style={styles.filterEmpty}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : filteredProviders.length === 0 ? (
          <View style={styles.filterEmpty}>
            <Text style={styles.filterEmptyText}>No providers match this filter right now.</Text>
          </View>
        ) : (
```
Add `ActivityIndicator` to the `react-native` import at the top of the file if it isn't already imported (check with `grep -n "ActivityIndicator" src/screens/customer/HomeScreen.tsx` first).

- [ ] **Step 3: `AllProvidersScreen.tsx` — same three-way split**

Read the current pattern (`data: providers = []` around line 56, `EmptyState` around line 80), then apply the same shape: destructure the loading flag, add an `ActivityIndicator` (or, if this screen already imports `EmptyState`, keep using it for the true-empty case and add a preceding loading branch using the same visual container it already renders into).

- [ ] **Step 4: `customer/JobsScreen.tsx` and `provider/JobsScreen.tsx` — same pattern**

Both files follow the identical shape (`data: job` for customer, likely a list for provider — confirm with `grep -n "useQuery\|data:" src/screens/provider/JobsScreen.tsx` first since the audit only pinned line numbers for the `EmptyState` calls at `:66`/`:65`). Add the loading flag to the destructuring and an `ActivityIndicator` branch before the existing `EmptyState`.

- [ ] **Step 5: `RequestsScreen.tsx` — add the loading flag to `useMyActiveRequest`**

Read line 102's destructuring:
```tsx
  const { data: request, refetch: refetchRequest } = useMyActiveRequest(profile?.id ?? null);
```
Change to:
```tsx
  const { data: request, isLoading: requestLoading, refetch: refetchRequest } = useMyActiveRequest(profile?.id ?? null);
```
Find where `showFeed`/`EmptyState` is rendered (search `grep -n "showFeed\|EmptyState" src/screens/customer/RequestsScreen.tsx`) and add a loading branch ahead of the `showFeed ? ... : <EmptyState .../>` ternary, e.g.:
```tsx
        {requestLoading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : showFeed ? (
```
(closing the ternary's existing final `)}` unchanged — only the opening branch gains one more level).

- [ ] **Step 6: `ChatListScreen.tsx` — add the loading flag to `useThreadsForRole`**

Read line 41:
```tsx
  const { data: threads = [], refetch } = useThreadsForRole(profile?.id ?? null, role);
```
Change to:
```tsx
  const { data: threads = [], isLoading: threadsLoading, refetch } = useThreadsForRole(profile?.id ?? null, role);
```
Find the render branch (`threads.length ? ... : <EmptyState title="No conversations yet" />`) and add a loading branch:
```tsx
        {threadsLoading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : threads.length ? (
```

- [ ] **Step 7: `ChatThreadScreen.tsx` — add both a loading indicator and a "say hello" empty state**

Read line 17-18's destructuring:
```tsx
  const { data: messages = [] } = useMessages(threadId);
```
Change to:
```tsx
  const { data: messages = [], isLoading: messagesLoading } = useMessages(threadId);
```
Find the `<FlatList data={messages} ... />` and give it an `ListEmptyComponent`:
```tsx
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            messagesLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.inkFaint, fontFamily: fonts.medium, fontSize: 13.5 }}>
                  Say hello 👋
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => {
```
(`contentContainerStyle` gains `flexGrow: 1` so the empty-state view can actually center itself when the list has zero rows; `fonts` needs to already be imported in this file — confirm with `grep -n "^import.*fonts" src/screens/shared/ChatThreadScreen.tsx`, it is per the earlier read of this file in this conversation.)

- [ ] **Step 8: Verify every touched file compiles (no TypeScript syntax errors from the ternary/prop edits)**

Run:
```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "HomeScreen|AllProvidersScreen|JobsScreen|RequestsScreen|ChatListScreen|ChatThreadScreen"
```
Expected: no output (no type errors in the touched files). If `tsc` reports unrelated pre-existing errors elsewhere in the project, that's fine — only check that no *new* errors appear in these seven files.

- [ ] **Step 9: Manually verify in the running app**

Using the **run** skill and a throttled/slow network (or by adding a brief `await new Promise(r => setTimeout(r, 1500))` temporarily inside one query function to force a visible loading window, then removing it), confirm each of the seven screens shows a spinner before its content/empty state, rather than flashing the empty state first.

- [ ] **Step 10: Commit**

```bash
git add src/screens/customer/HomeScreen.tsx src/screens/customer/AllProvidersScreen.tsx src/screens/customer/JobsScreen.tsx src/screens/provider/JobsScreen.tsx src/screens/customer/RequestsScreen.tsx src/screens/shared/ChatListScreen.tsx src/screens/shared/ChatThreadScreen.tsx
git commit -m "fix: distinguish loading from empty state on 7 list/chat screens"
```

---

### Task 7: Accessibility pass — labels, roles, and touch targets on icon-only buttons

**Finding:** *"Only 7 `accessibilityLabel` occurrences exist across the app against 78 `<Pressable>` usages... `ScreenHeader.tsx` back button used on nearly every screen with a header... `ReferralScreen.tsx:42-43` share button... `ChatThreadScreen.tsx:68-69` send button (also no hitSlop)... `NewRequestScreen.tsx:423-429` photo-remove... `PortfolioScreen.tsx:75-84` portfolio photo delete button."*

Fixing `ScreenHeader.tsx` (a shared component rendered on nearly every screen with a back button) is the highest-leverage single edit in this task.

**Files:**
- Modify: `src/components/ScreenHeader.tsx`
- Modify: `src/screens/shared/ReferralScreen.tsx`
- Modify: `src/screens/shared/ChatThreadScreen.tsx`
- Modify: `src/screens/provider/PortfolioScreen.tsx`
- Modify: `src/screens/customer/NewRequestScreen.tsx`

**Interfaces:** No signature changes — every edit adds `accessibilityRole`/`accessibilityLabel`/`hitSlop` props to existing `<Pressable>` elements.

- [ ] **Step 1: `ScreenHeader.tsx` — label the back button (fixes nearly every screen at once)**

Replace:
```tsx
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={[
              styles.back,
              {
                backgroundColor: dark ? 'rgba(255,255,255,0.1)' : colors.paperDim,
                borderColor: dark ? 'rgba(255,255,255,0.14)' : colors.hairline,
              },
            ]}
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={foreground} />
          </Pressable>
```
with:
```tsx
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[
              styles.back,
              {
                backgroundColor: dark ? 'rgba(255,255,255,0.1)' : colors.paperDim,
                borderColor: dark ? 'rgba(255,255,255,0.14)' : colors.hairline,
              },
            ]}
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={foreground} />
          </Pressable>
```

- [ ] **Step 2: `ReferralScreen.tsx` — label the share button**

Replace:
```tsx
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Share2 size={16} strokeWidth={2.2} color={colors.white} />
          <Text style={styles.shareLabel}>Share invite</Text>
        </Pressable>
```
with:
```tsx
        <Pressable style={styles.shareBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share invite code">
          <Share2 size={16} strokeWidth={2.2} color={colors.white} />
          <Text style={styles.shareLabel}>Share invite</Text>
        </Pressable>
```

- [ ] **Step 3: `ChatThreadScreen.tsx` — label the send button and add `hitSlop`**

Replace:
```tsx
          <Pressable style={styles.sendBtn} onPress={handleSend}>
            <ArrowUp size={18} strokeWidth={2.4} color={colors.white} />
          </Pressable>
```
with:
```tsx
          <Pressable
            style={styles.sendBtn}
            onPress={handleSend}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <ArrowUp size={18} strokeWidth={2.4} color={colors.white} />
          </Pressable>
```

- [ ] **Step 4: `PortfolioScreen.tsx` — label the delete button and widen `hitSlop`**

Replace:
```tsx
              <Pressable
                hitSlop={8}
                style={styles.removeBadge}
                onPress={() => handleDelete(photo.id, photo.photo_url)}
                disabled={deletingId === photo.id}
              >
```
with:
```tsx
              <Pressable
                hitSlop={10}
                style={styles.removeBadge}
                onPress={() => handleDelete(photo.id, photo.photo_url)}
                disabled={deletingId === photo.id}
                accessibilityRole="button"
                accessibilityLabel="Delete this photo"
              >
```

- [ ] **Step 5: `NewRequestScreen.tsx` — label the photo-remove button and widen `hitSlop`**

Replace:
```tsx
                  <Pressable
                    hitSlop={8}
                    style={styles.photoRemove}
                    onPress={() => setPhotoUris((prev) => prev.filter((u) => u !== uri))}
                  >
                    <X size={12} strokeWidth={3} color={colors.white} />
                  </Pressable>
```
with:
```tsx
                  <Pressable
                    hitSlop={10}
                    style={styles.photoRemove}
                    onPress={() => setPhotoUris((prev) => prev.filter((u) => u !== uri))}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this photo"
                  >
                    <X size={12} strokeWidth={3} color={colors.white} />
                  </Pressable>
```

- [ ] **Step 6: Verify all five edits landed**

Run:
```bash
grep -n "accessibilityLabel" src/components/ScreenHeader.tsx src/screens/shared/ReferralScreen.tsx src/screens/shared/ChatThreadScreen.tsx src/screens/provider/PortfolioScreen.tsx src/screens/customer/NewRequestScreen.tsx
```
Expected: one match in each of the five files.

- [ ] **Step 7: Manually verify in the running app**

Using the **run** skill with a screen reader enabled (VoiceOver on iOS Simulator, or TalkBack on Android), navigate to a screen with a back button and confirm it announces "Go back, button" instead of nothing. Tap the delete/remove buttons on Portfolio and New Request to confirm the slightly larger `hitSlop` doesn't cause any accidental overlap with neighboring photo thumbnails.

- [ ] **Step 8: Commit**

```bash
git add src/components/ScreenHeader.tsx src/screens/shared/ReferralScreen.tsx src/screens/shared/ChatThreadScreen.tsx src/screens/provider/PortfolioScreen.tsx src/screens/customer/NewRequestScreen.tsx
git commit -m "a11y: label icon-only buttons and widen small touch targets"
```

---

### Task 8: Text truncation pass — headers, button labels, and dynamic name fields

**Finding:** *"`ScreenHeader.tsx:42` — the title `<Text>` has no `numberOfLines`, and its parent `row` has no `flex: 1` on the text node... a long business name can overflow past the screen edge... `Button.tsx:52` — button label has no `numberOfLines`... several list rows show dynamic name/text fields without `numberOfLines`."*

**Files:**
- Modify: `src/components/ScreenHeader.tsx`
- Modify: `src/components/Button.tsx`
- Modify: `src/screens/shared/ChatListScreen.tsx`
- Modify: `src/screens/shared/ChatThreadScreen.tsx`
- Modify: `src/screens/customer/SavedProvidersScreen.tsx`
- Modify: `src/screens/customer/AllProvidersScreen.tsx`
- Modify: `src/screens/customer/ProfileScreen.tsx`
- Modify: `src/screens/provider/ProfileScreen.tsx`
- Modify: `src/screens/customer/RateJobScreen.tsx`
- Modify: `src/screens/customer/ProviderDetailScreen.tsx`

**Interfaces:** No signature changes — every edit adds `numberOfLines={1}` (and, for `ScreenHeader`, `flex: 1`) to existing `<Text>` elements displaying dynamic content.

- [ ] **Step 1: `ScreenHeader.tsx` — cap the title to one line and let it shrink instead of push past the edge**

Replace:
```tsx
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[
              styles.back,
              {
                backgroundColor: dark ? 'rgba(255,255,255,0.1)' : colors.paperDim,
                borderColor: dark ? 'rgba(255,255,255,0.14)' : colors.hairline,
              },
            ]}
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={foreground} />
          </Pressable>
          <Text style={[styles.title, { color: foreground }]}>{title}</Text>
```
with:
```tsx
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[
              styles.back,
              {
                backgroundColor: dark ? 'rgba(255,255,255,0.1)' : colors.paperDim,
                borderColor: dark ? 'rgba(255,255,255,0.14)' : colors.hairline,
              },
            ]}
          >
            <ChevronLeft size={20} strokeWidth={2.4} color={foreground} />
          </Pressable>
          <Text style={[styles.title, { color: foreground, flex: 1 }]} numberOfLines={1}>
            {title}
          </Text>
```
(The non-`onBack` branch further down, `<Text style={[large ? styles.titleLarge : styles.title, { color: foreground }]}>`, doesn't need `flex: 1` since it has no siblings, but add `numberOfLines={1}` there too for consistency — find it with `grep -n "titleLarge ? styles" src/components/ScreenHeader.tsx` and apply the same `numberOfLines={1}` prop.)

- [ ] **Step 2: `Button.tsx` — cap the label to one line**

Replace (from Task 1's already-updated version):
```tsx
        <Text style={[styles.label, { color: isPrimary ? colors.paper : isFilled ? colors.white : colors.ink }]}>
          {title}
        </Text>
```
with:
```tsx
        <Text
          style={[styles.label, { color: isPrimary ? colors.paper : isFilled ? colors.white : colors.ink }]}
          numberOfLines={1}
        >
          {title}
        </Text>
```

- [ ] **Step 3: `ChatListScreen.tsx` — cap the peer name in each thread row**

Replace:
```tsx
        <Text style={styles.name}>{peer.full_name}</Text>
```
with:
```tsx
        <Text style={styles.name} numberOfLines={1}>{peer.full_name}</Text>
```

- [ ] **Step 4: `ChatThreadScreen.tsx` — cap the peer name in the header**

Replace:
```tsx
        <Text style={styles.peerName}>{peer?.full_name}</Text>
```
with:
```tsx
        <Text style={styles.peerName} numberOfLines={1}>{peer?.full_name}</Text>
```
(This `Text` sits in a `flexDirection: 'row'` header alongside the back button and avatar — check whether it already has `flex: 1` via `grep -n "peerName" -B3 src/screens/shared/ChatThreadScreen.tsx`; if the parent row has no `flex:1` on this text either, add it inline the same way as Task 8 Step 1: `style={[styles.peerName, { flex: 1 }]}`.)

- [ ] **Step 5: `SavedProvidersScreen.tsx` and `AllProvidersScreen.tsx` — cap provider names**

In both files, find the provider name `Text` (search `grep -n "full_name" src/screens/customer/SavedProvidersScreen.tsx src/screens/customer/AllProvidersScreen.tsx`) and add `numberOfLines={1}` to each.

- [ ] **Step 6: `customer/ProfileScreen.tsx` and `provider/ProfileScreen.tsx` — cap the hero name and saved-provider row names**

In both files, find `heroName` (the profile's own display name, `grep -n "heroName" src/screens/customer/ProfileScreen.tsx src/screens/provider/ProfileScreen.tsx`) and the saved-provider row name (`savedName` in the customer file) and add `numberOfLines={1}` to each `Text`.

- [ ] **Step 7: `RateJobScreen.tsx` — cap the peer name**

Find the `peerName` `Text` (`grep -n "peerName" src/screens/customer/RateJobScreen.tsx`) and add `numberOfLines={1}`.

- [ ] **Step 8: `ProviderDetailScreen.tsx` — cap the provider name in the hero section**

Find the `name` style `Text` displaying `provider.full_name` (`grep -n "styles.name}" src/screens/customer/ProviderDetailScreen.tsx`) and add `numberOfLines={1}`. Note this hero name sits in a `flex: 1` column already (per the hero layout read earlier in this conversation), so no additional `flex` prop is needed here.

- [ ] **Step 9: Verify every touched file has the new prop**

Run:
```bash
grep -c "numberOfLines={1}" src/components/ScreenHeader.tsx src/components/Button.tsx src/screens/shared/ChatListScreen.tsx src/screens/shared/ChatThreadScreen.tsx src/screens/customer/SavedProvidersScreen.tsx src/screens/customer/AllProvidersScreen.tsx src/screens/customer/ProfileScreen.tsx src/screens/provider/ProfileScreen.tsx src/screens/customer/RateJobScreen.tsx src/screens/customer/ProviderDetailScreen.tsx
```
Expected: every listed file reports a count ≥ 1 (several already had `numberOfLines` elsewhere, e.g. `ProviderDetailScreen.tsx`'s `provider.provider_category` line, so the count may be higher than 1 in some files — the check is that it's not 0).

- [ ] **Step 10: Manually verify in the running app**

Using the **run** skill, find or create a test provider/customer profile with an unusually long name (30+ characters) and confirm it truncates with an ellipsis instead of wrapping or overflowing on: the screen header, a chat thread header and list row, the provider detail hero, and a saved-providers row.

- [ ] **Step 11: Commit**

```bash
git add src/components/ScreenHeader.tsx src/components/Button.tsx src/screens/shared/ChatListScreen.tsx src/screens/shared/ChatThreadScreen.tsx src/screens/customer/SavedProvidersScreen.tsx src/screens/customer/AllProvidersScreen.tsx src/screens/customer/ProfileScreen.tsx src/screens/provider/ProfileScreen.tsx src/screens/customer/RateJobScreen.tsx src/screens/customer/ProviderDetailScreen.tsx
git commit -m "fix: truncate long dynamic names instead of letting them overflow"
```

---

### Task 9: Remove dead progress-bar styles

**Finding:** *"`HomeScreen.tsx:352-353` — `heroProgressTrack` and `heroProgressFill` are defined in `makeStyles` but never referenced in the component JSX. `JobDetailScreen.tsx:191-192` (customer) — `progressTrack` and `progressFill` defined but unused."*

**Files:**
- Modify: `src/screens/customer/HomeScreen.tsx`
- Modify: `src/screens/customer/JobDetailScreen.tsx`

**Interfaces:** No changes — pure deletion of unreferenced style keys.

- [ ] **Step 1: Confirm both style keys are genuinely unreferenced before deleting**

Run:
```bash
grep -n "heroProgressTrack\|heroProgressFill" src/screens/customer/HomeScreen.tsx
grep -n "progressTrack\|progressFill" src/screens/customer/JobDetailScreen.tsx
```
Expected: each name appears exactly once (only in its own `makeStyles` definition, never in JSX via `styles.heroProgressTrack`/`styles.progressTrack` etc.). If a JSX reference does turn up, stop and re-check the audit finding rather than deleting a style that's actually in use.

- [ ] **Step 2: Delete the two unused styles from `HomeScreen.tsx`**

Replace:
```tsx
    heroActivityDetail: { color: colors.inkMuted, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.medium },
    heroProgressTrack: { height: 3, marginTop: 3, borderRadius: radii.pill, overflow: 'hidden', backgroundColor: colors.hairline },
    heroProgressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.confirm },

    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
```
with:
```tsx
    heroActivityDetail: { color: colors.inkMuted, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.medium },

    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
```

- [ ] **Step 3: Delete the two unused styles from `JobDetailScreen.tsx` (customer)**

Replace:
```tsx
    progressStep: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, fontVariant: ['tabular-nums'] },
    progressTrack: { height: 6, borderRadius: radii.pill, backgroundColor: colors.paperDim, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.ink, borderRadius: radii.pill },
    progressNote: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkMuted },
```
with:
```tsx
    progressStep: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, fontVariant: ['tabular-nums'] },
    progressNote: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkMuted },
```

- [ ] **Step 4: Verify the app still builds with these keys gone**

Run:
```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "HomeScreen.tsx|JobDetailScreen.tsx"
```
Expected: no new errors referencing the deleted style keys.

- [ ] **Step 5: Commit**

```bash
git add src/screens/customer/HomeScreen.tsx src/screens/customer/JobDetailScreen.tsx
git commit -m "chore: remove dead progress-bar styles left over from an earlier design"
```

---

### Task 10: Admin — consolidate the two dark-mode toggle implementations

**Finding:** *"`app/settings/page.tsx:5-15,37-58` reimplements the exact same dark/light toggle logic independently of `ThemeToggle.tsx`... two separate, unsynchronized implementations of the same feature."* and *"`app/layout.tsx:16,22` hardcodes `data-theme=\"dark\"` on `<html>` for every server render... a user who has chosen 'light' sees a flash of the dark theme on every navigation/reload."*

This task extracts the shared read/write logic into one hook, and fixes the SSR flash by persisting the choice in a cookie the server layout can read.

**Files:**
- Create: `admin/app/hooks/useAdminTheme.ts`
- Modify: `admin/app/components/ThemeToggle.tsx`
- Modify: `admin/app/settings/page.tsx`
- Modify: `admin/app/layout.tsx`

**Interfaces:**
- Produces: `useAdminTheme()` — a client hook returning `{ theme: 'dark' | 'light', setTheme: (next: 'dark' | 'light') => void }`. `theme` is read from `document.documentElement`'s `data-theme` attribute on mount (matching the value the server already rendered from the cookie, so there's no flash) and updated via `setTheme`, which writes both `localStorage` (for continuity with existing behavior) and a `admin-theme` cookie (so the server can read it), and updates the `data-theme` attribute immediately.
- Consumes (in `layout.tsx`): `cookies()` from `next/headers`.

- [ ] **Step 1: Create the shared hook**

Create `admin/app/hooks/useAdminTheme.ts`:
```tsx
'use client';

import { useEffect, useState } from 'react';

export type AdminTheme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const COOKIE_KEY = 'admin-theme';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readInitialTheme(): AdminTheme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' ? 'light' : 'dark';
}

/** Single source of truth for the admin dashboard's dark/light preference.
 * The server (see app/layout.tsx) reads the `admin-theme` cookie to render
 * the correct `data-theme` on first paint, avoiding a flash; this hook keeps
 * localStorage in sync too so the choice survives even if cookies are
 * cleared, and every UI that lets the user change theme (ThemeToggle,
 * the Settings page) shares this one read/write path instead of each
 * re-implementing it. */
export function useAdminTheme() {
  const [theme, setThemeState] = useState<AdminTheme>(readInitialTheme);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as AdminTheme | null;
    const attr = document.documentElement.getAttribute('data-theme') as AdminTheme | null;
    const initial = attr ?? stored ?? 'dark';
    setThemeState(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  function setTheme(next: AdminTheme) {
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  return { theme, setTheme };
}
```

- [ ] **Step 2: Rewrite `ThemeToggle.tsx` to use the shared hook**

Replace the entire file with:
```tsx
'use client';

import { useAdminTheme } from '../hooks/useAdminTheme';

export default function ThemeToggle() {
  const { theme, setTheme } = useAdminTheme();

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Rewrite `settings/page.tsx`'s theme section to use the shared hook**

Replace:
```tsx
'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [theme, setTheme] = useState<string>(
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') ?? 'dark'
      : 'dark'
  );

  const switchTheme = (t: string) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    setTheme(t);
  };
```
with:
```tsx
'use client';

import { useAdminTheme } from '../hooks/useAdminTheme';

export default function SettingsPage() {
  const { theme, setTheme: switchTheme } = useAdminTheme();
```
(Every other reference to `theme`/`switchTheme` later in this file's JSX — the two "🌙 Dark Mode"/"☀️ Light Mode" buttons' `onClick={() => switchTheme('dark')}` and `theme === 'dark'` checks — stays exactly as-is, since the destructured names are unchanged.)

- [ ] **Step 4: Read the cookie server-side in `layout.tsx` to eliminate the FOUC**

Replace:
```tsx
import './globals.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { createServerSupabase } from '../lib/supabase';
import ThemeToggle from './components/ThemeToggle';
import NavLinks from './components/NavLinks';
import LogoutButton from './components/LogoutButton';

export const metadata = { title: 'Solid Connect Admin', description: 'Solid Connect operational administration' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <html data-theme="dark" className={`${GeistSans.variable} ${GeistMono.variable}`}><body>{children}</body></html>;
  const { data: admin } = await supabase.from('admins').select('id, email').eq('id', user.id).maybeSingle();
  if (!admin) { await supabase.auth.signOut(); redirect('/login?error=not-admin'); }
  const initials = (admin.email ?? 'A').slice(0, 2).toUpperCase();

  return (
    <html data-theme="dark" className={`${GeistSans.variable} ${GeistMono.variable}`}><body>
```
with:
```tsx
import './globals.css';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { createServerSupabase } from '../lib/supabase';
import ThemeToggle from './components/ThemeToggle';
import NavLinks from './components/NavLinks';
import LogoutButton from './components/LogoutButton';

export const metadata = { title: 'Solid Connect Admin', description: 'Solid Connect operational administration' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('admin-theme')?.value === 'light' ? 'light' : 'dark';
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <html data-theme={theme} className={`${GeistSans.variable} ${GeistMono.variable}`}><body>{children}</body></html>;
  const { data: admin } = await supabase.from('admins').select('id, email').eq('id', user.id).maybeSingle();
  if (!admin) { await supabase.auth.signOut(); redirect('/login?error=not-admin'); }
  const initials = (admin.email ?? 'A').slice(0, 2).toUpperCase();

  return (
    <html data-theme={theme} className={`${GeistSans.variable} ${GeistMono.variable}`}><body>
```
(No other lines in this file change — the rest of the returned JSX, including the `<ThemeToggle />` placement, stays identical.)

- [ ] **Step 5: Verify the cookie round-trip**

Run:
```bash
grep -n "admin-theme" admin/app/hooks/useAdminTheme.ts admin/app/layout.tsx
```
Expected: the cookie name `admin-theme` appears in both files (write side in the hook, read side in the layout).

- [ ] **Step 6: Manually verify in the running app**

Run the admin dashboard locally (`cd admin && npm run dev`), open it in a browser, toggle to light mode via the header `ThemeToggle`, then hard-refresh the page (Cmd/Ctrl+Shift+R) — the page should render light immediately with no dark flash. Then open Settings and confirm its two theme buttons reflect and control the same state (toggling from Settings should also update the header toggle's icon after a refresh, since they now share the same cookie/localStorage source).

- [ ] **Step 7: Commit**

```bash
git add admin/app/hooks/useAdminTheme.ts admin/app/components/ThemeToggle.tsx admin/app/settings/page.tsx admin/app/layout.tsx
git commit -m "refactor(admin): unify dark-mode toggle into one hook, read theme cookie server-side to kill FOUC"
```

---

### Task 11: Admin — theme-aware login page, `--ring` token fix, analytics chart palette, analytics loading state

**Finding:** *"`app/login/page.tsx` + `app/login/polish.css` — styled entirely with hardcoded hex literals... always renders in a fixed light theme regardless of the `data-theme` attribute."* Plus: *"`globals.css:38,68` — the `--ring` token is blue in dark theme but orange in light theme, an apparent copy-paste mismatch."* Plus: *"`analytics/page.tsx:341` hardcodes a 5-color JS array... drifts from the rest of the light-mode UI."* Plus: *"`analytics/` is the one data route missing a `loading.tsx`."*

**Files:**
- Modify: `admin/app/login/polish.css`
- Modify: `admin/app/globals.css`
- Modify: `admin/app/analytics/page.tsx`
- Create: `admin/app/analytics/loading.tsx`

**Interfaces:** No component signature changes — CSS token swaps, one color-array literal swap, and one new Next.js route-loading file following the existing `PageSkeleton` convention.

- [ ] **Step 1: Rewrite `polish.css` to use the shared theme CSS variables instead of hardcoded hex**

Replace the entire contents of `admin/app/login/polish.css` with:
```css
.reference-login { min-height:100dvh; display:grid; place-items:center; overflow:hidden; position:relative; padding:24px; background:var(--bg-primary); color:var(--text-primary); }


.reference-card { position:relative; z-index:2; width:min(100%,420px); padding:40px 36px 30px; background:var(--bg-card); border:1px solid var(--border); border-radius:24px; box-shadow:var(--shadow-lg); text-align:center; }

.reference-icon { width:96px; height:96px; margin:0 auto 20px; object-fit:contain; }

.reference-card h1 { margin:0; font-size:25px; letter-spacing:-.045em; color:var(--text-primary); }
.reference-subtitle { margin:7px 0 25px; color:var(--text-secondary); line-height:1.45; font-size:14px; }

.reference-card form { display:grid; gap:10px; text-align:left; }
.reference-input { display:flex; align-items:center; gap:9px; height:40px; padding:0 12px; border-radius:10px; background:var(--bg-input); color:var(--text-secondary); border:1px solid var(--border); transition:border-color .2s; }
.reference-input:focus-within { outline:2px solid var(--ring); border-color:var(--accent); }
.reference-input > svg { flex-shrink:0; color:var(--text-muted); }
.reference-input input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:var(--text-primary); font-size:13px; }
.reference-input input::placeholder { color:var(--text-muted); }
.reference-input button { border:0; background:none; color:var(--text-muted); padding:0; font-size:15px; }

.forgot-link { align-self:end; margin:0 2px 3px; color:var(--text-secondary); font-size:12px; text-decoration:none; }
.forgot-link:hover { text-decoration:underline; color:var(--text-primary); }

.reference-submit { height:40px; border:0; border-radius:10px; background:linear-gradient(180deg,var(--accent),var(--accent-hover)); color:white; font-size:14px; font-weight:700; box-shadow:0 5px 10px var(--accent-border); transition:transform .2s,box-shadow .2s; }
.reference-submit:hover { transform:translateY(-1px); box-shadow:0 8px 16px var(--accent-border); }
.reference-submit:active { transform:translateY(1px); }
.reference-submit:disabled { opacity:.65; cursor:wait; }

.reference-card .notice { text-align:left; margin:3px 0 0; color:var(--red); }
.or-divider { display:flex; align-items:center; gap:10px; margin:21px 0 16px; color:var(--text-muted); font-size:11px; }
.or-divider::before,.or-divider::after { content:""; flex:1; height:1px; background:var(--border); }
.social-row { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.social-row button { height:40px; border:1px solid var(--border); border-radius:10px; background:var(--bg-input); color:var(--text-primary); font-weight:800; font-size:17px; }
.social-row button:disabled { cursor:not-allowed; opacity:.85; }

@media(max-width:560px){.reference-login{padding:18px}.reference-card{padding:32px 24px 25px}}
```
(Every hardcoded hex/rgba value is replaced 1:1 with the closest-matching existing `--*` variable from `globals.css`; layout, spacing, and structure are untouched, so the page's shape doesn't change — only its colors now follow `data-theme`.)

- [ ] **Step 2: Fix the `--ring` mismatch in `globals.css`**

Replace:
```css
  --ring: rgba(234,88,12,.2);
```
(inside the `[data-theme="light"]` block, currently the second of two `--ring` definitions in the file) with:
```css
  --ring: rgba(30,58,138,.2);
```
(matching the light theme's `--accent: #1e3a8a` the same way the dark theme's `--ring: rgba(52,89,212,.25)` already matches its own `--accent: #3459d4`.)

- [ ] **Step 3: Swap the hardcoded chart palette in `analytics/page.tsx` for theme variables**

Replace:
```tsx
                color: ['#3459d4', '#3b82f6', '#22c55e', '#a855f7', '#ef4444'][i],
```
with:
```tsx
                color: ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--red)'][i],
```

- [ ] **Step 4: Add a `loading.tsx` for the analytics route**

Create `admin/app/analytics/loading.tsx`:
```tsx
import { PageSkeleton } from '../components/PageSkeleton';

export default function Loading() {
  return <PageSkeleton statCount={4} />;
}
```
(Matches the exact convention used by `customers/loading.tsx`, `disputes/loading.tsx`, etc. — read `admin/app/customers/loading.tsx` again beforehand if the `statCount` for analytics's actual stat-card row differs from 4; count the `stat-card` divs rendered at the top of `analytics/page.tsx` with `grep -c "stat-card" admin/app/analytics/page.tsx` and match that number.)

- [ ] **Step 5: Verify no hardcoded hex remain in the touched files**

Run:
```bash
grep -n "#[0-9a-fA-F]\{3,6\}" admin/app/login/polish.css
```
Expected: no matches (every color is now a `var(--...)` reference).

- [ ] **Step 6: Manually verify in the running app**

Run the admin dashboard locally, toggle to light mode via the header `ThemeToggle`, then sign out and visit `/login` — it should now render in light theme (previously always light regardless), and re-toggling to dark and visiting `/login` again should render it dark. Focus an input field and confirm the focus ring color now looks like a blue/navy tint (matching `--accent`) instead of an unrelated orange in light mode. Visit `/analytics` and confirm the "Provider Categories" donut chart's colors still look reasonable in both themes, and that a slow-loading `/analytics` visit shows the skeleton instead of a blank page.

- [ ] **Step 7: Flag the `/access` duplicate for a product decision (do not delete without confirmation)**

`admin/app/access/page.tsx` is a second, already-theme-aware login page that nothing in the codebase links to (confirmed via `grep -rn "'/access'\|\"/access\"" admin/` finding only its own route file). This plan does not delete it, since removing a route is a product call, not a pure consistency fix — after this task is otherwise complete, surface this finding to the project owner and ask whether `/access` should be deleted, kept as a spare, or become the canonical `/login` (in which case `/login`'s current markup would be replaced by `/access`'s in a follow-up task).

- [ ] **Step 8: Commit**

```bash
git add admin/app/login/polish.css admin/app/globals.css admin/app/analytics/page.tsx admin/app/analytics/loading.tsx
git commit -m "fix(admin): make login page theme-aware, fix ring token mismatch, theme the analytics chart, add analytics loading state"
```

---

## Self-Review Notes

- **Spec coverage:** every numbered finding from the audit (Button contrast bug; Splash/AuthFlow hardcoded backgrounds; avatar circle bug; card-pattern inconsistency incl. the `ReviewCard`/`TabBar` outliers; orange usage — already resolved in-session, no task needed; accessibility gaps; loading/empty gaps; text truncation gaps; dead styles; admin theme duplication/FOUC/login/`--ring`/analytics) maps to Tasks 1-11. The audit's "magic numbers vs. spacing scale" and "navigation oddities" findings were explicitly called out by the audit itself as representative/non-actionable-without-a-product-decision respectively, so they're intentionally not turned into tasks — see the note below.
- **Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N" phrasing was used; every step carries the literal code to write.
- **Type consistency:** `shadow.card`'s shape (Task 4) is used identically (`...shadow.card`) everywhere it's consumed in Tasks 4-5; `useAdminTheme()`'s returned `{ theme, setTheme }` names are used identically in Task 10's `ThemeToggle.tsx` and `settings/page.tsx` edits.

**Deliberately out of scope for this plan** (from the audit, but not fixed here — flag to the project owner rather than deciding unilaterally):
- The audit's "magic numbers" finding was explicitly a representative sample, not an exhaustive list — sweeping every raw pixel value in the codebase to a spacing/radii token is a much larger, lower-value mechanical change better done opportunistically as files are touched for other reasons, not as a dedicated task.
- `NotificationsScreen` not being reachable from `ProviderTabs.tsx` is a product/feature-parity question (should providers get notification preferences?), not a bug — needs a decision before it becomes a task.
- The `/access` vs `/login` admin duplication (Task 11, Step 7) is flagged but not resolved by deletion in this plan, for the same reason.
- The final whole-branch review found additional border-only cards that Task 5's original file list (an audit taken before an interstitial checkpoint commit landed) didn't cover: `AllProvidersScreen.tsx` (`card`), `SavedProvidersScreen.tsx`, `provider/JobsScreen.tsx`, `provider/FeedScreen.tsx`, `RateJobScreen.tsx` (peerCard/rateCard/commentCard), `MatchingScreen.tsx`, `NewRequestScreen.tsx`, `AccountSecurityScreen.tsx`, `DisputeScreen.tsx`, `VerificationScreen.tsx`. These remain border-only (not yet migrated to the `shadow.card` pattern); migrating them is out of scope for this plan — a future pass, not silently forgotten.
