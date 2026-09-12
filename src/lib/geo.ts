import { Linking, Platform } from 'react-native';

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lng points, in kilometers. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** "450 m" under 1 km, "1.2 km" / "12 km" above it. */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** "just now" / "42s ago" / "3m ago" / "2h ago" from an ISO timestamp. */
export function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Opens a lat/lng in the device's own Maps app - no in-app map view, no
 * map SDK/API key dependency. Apple Maps on iOS (opens the app directly,
 * no key required); Google Maps web URL everywhere else, which Android
 * intercepts into its own Maps app when installed and otherwise opens in
 * a browser.
 */
export function openInMaps(lat: number, lng: number, label?: string) {
  const query = encodeURIComponent(label ?? 'Location');
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?ll=${lat},${lng}&q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}
