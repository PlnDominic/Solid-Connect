# Mobile release readiness

Updated 2026-11-06. This checklist tracks the Expo app's remaining App Store
and Google Play work independently of API and admin deployment.

## Completed in this pass

- Replaced Expo starter artwork with the Solid Connect mark for the iOS app
  icon, Android adaptive icon and monochrome icon, splash screen, and Android
  notification icon. Source artwork is `assets/images/logo.jpeg`; regenerate
  the PNG assets with `scripts/generate-app-icons.ps1`.
- Configured the SDK 57 splash-screen plugin and Android notification glyph.
- Added the SDK 57 `expo-asset` peer dependency used by `expo-audio`.
- Removed the project-local `eas-cli` dependency; use EAS CLI in the build
  environment instead.
- Set explicit EAS environments for development, preview, and production.
- Added the production Supabase URL and anon key to the linked EAS project's
  production environment (the key is stored as a sensitive variable).
- Chose store releases for launch; OTA updates are disabled until a separate
  update rollout policy is adopted.
- Removed Twi and Ga from the app, including the language picker and locale
  dictionaries. English is the only app language.
- Removed the placeholder support phone number and aligned the displayed
  support email with the `.co` address used in platform configuration.

## Still required before store builds

### EAS and backend configuration

Still create these variables in the EAS **production** environment before a
working production build:

- `EXPO_PUBLIC_API_URL` (the Nest API is not deployed yet; use its real HTTPS
  URL once hosting is ready)
- `EXPO_PUBLIC_LEGAL_URL` (after counsel approves and legal pages are live)

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are already
configured in EAS production.

Configure Android FCM credentials and the `google-services.json` file, and
configure the iOS APNs key in EAS. The repository does not contain these
account credentials. Install the release on physical iOS and Android devices
and verify notification registration, delivery, and notification deep links.

### Store submission setup

- Fill `eas.json`'s production submit configuration with the Apple App Store
  Connect app record and Google Play service-account credentials.
- Enroll the organization in Apple Developer and Google Play Console; confirm
  the app records use bundle/package ID `com.solidconnect.app`.
- Prepare store descriptions, screenshots, keywords, support and privacy URLs,
  age ratings, Apple privacy disclosures, Play Data Safety answers, and
  permission justifications for location, camera, photos, and microphone.
- Publish a web account-deletion page and put its URL in the Google Play
  listing. The in-app deletion request does not supply this required public
  URL by itself.
- Prepare customer and verified-provider review accounts with representative
  job states.
- Select and configure the verified domain for Universal Links and Android App
  Links. The app currently only has the `solidconnect://` scheme.

### Product, policy, and quality gates

- Have counsel approve the Terms, Privacy Policy, Provider Agreement, and
  Refund & Dispute Policy before linking them from the app or store listings.
- Add explicit Provider Agreement and payout-terms acceptance to provider
  onboarding after the approved terms and required database version are ready.
- Verify user phone numbers with an SMS provider before relying on them for
  provider reachability or MoMo payouts.
- Confirm `support@solidconnect.co` is a staffed, monitored address. The app no
  longer shows the audit's placeholder phone number; no real support phone was
  supplied in the repository.
- Remove users' stored photos and verification files during account deletion,
  consistent with the published privacy policy.
- Test release builds on real iOS and low-end Android devices, including poor
  connectivity, notification permissions, auth redirects, camera/media/audio,
  account deletion, and payment flows. Run the small-payment beta and store
  review before public release.

## Configuration note

The checked-in `eas.json` selects EAS environments but intentionally contains
no production URLs, credentials, app-store IDs, or service-account keys. Set
those values in the relevant EAS project and store consoles; do not commit
private keys or the Android service-account file.
