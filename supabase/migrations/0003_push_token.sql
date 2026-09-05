-- Solid Connect - push notification subscription
-- Recorded right after sign-up: the OS permission outcome, and the Expo
-- push token when the device actually has one. Nullable throughout -
-- existing rows have neither, "denied"/"skipped" have a status but no
-- token, and a device without a linked EAS project (no eas.json yet in
-- this repo) will have a status but a null token until that's set up.

alter table public.profiles
  add column if not exists push_token text,
  add column if not exists push_permission_status text;
