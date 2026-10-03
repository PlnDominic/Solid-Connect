# Phase I — Gap

Date: 2026-09-28  
Scope: In-app notifications, device push (FCM and APNs), preferences, background delivery

## Before

- The inbox, preference toggles, and Expo token registration were already in the app.
- A database trigger called Expo immediately on every notification insert and ignored the result.
- A review did not notify the provider. Dead device tokens were never cleared.

## After

- Each notification is queued in `push_outbox`. The API drains that queue in the background and sends it through Expo, which delivers on FCM (Android) and APNs (iOS).
- Preferences still decide whether a push goes out. Receipts are checked later, and a token Expo reports as unregistered is removed.
- A new review notifies the provider. The inbox updates live, and "Clear all" goes through the API.
