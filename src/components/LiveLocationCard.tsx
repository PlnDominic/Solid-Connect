import { MapPin } from 'lucide-react-native';
import { Text, View, StyleSheet } from 'react-native';
import { useJobLocation } from '../hooks/useJobLocation';
import { formatDistanceKm, formatRelativeTime, haversineKm, openInMaps } from '../lib/geo';
import { Button } from './Button';
import { fonts, radii, shadow, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import type { Job } from '../types/database';

const ACTIVE_JOB_STATUSES = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];

/**
 * Shows the other party's live distance for an active job - "1.2 km away,
 * updated 12s ago" plus a button that opens their position in the device's
 * own Maps app. No in-app map view (see the useReportJobLocation plan's
 * "distance + open in Maps" direction): reads job_locations (written by
 * that job's own useReportJobLocation call on each device) and computes
 * distance entirely from the two already-reported halves of that one row,
 * so this component itself never needs its own GPS watch or permission
 * prompt. Renders nothing outside the active job window.
 */
export function LiveLocationCard({ job, viewerRole }: { job: Job; viewerRole: 'customer' | 'provider' }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: location } = useJobLocation(job.id);

  if (!ACTIVE_JOB_STATUSES.includes(job.status)) return null;

  const otherLabel = viewerRole === 'customer' ? 'Provider' : 'Customer';
  const other =
    viewerRole === 'customer'
      ? { lat: location?.provider_lat, lng: location?.provider_lng, updatedAt: location?.provider_updated_at }
      : { lat: location?.customer_lat, lng: location?.customer_lng, updatedAt: location?.customer_updated_at };
  const mine =
    viewerRole === 'customer'
      ? { lat: location?.customer_lat, lng: location?.customer_lng }
      : { lat: location?.provider_lat, lng: location?.provider_lng };

  const hasOther = other.lat != null && other.lng != null;
  const hasMine = mine.lat != null && mine.lng != null;
  const distanceKm = hasOther && hasMine ? haversineKm({ lat: mine.lat!, lng: mine.lng! }, { lat: other.lat!, lng: other.lng! }) : null;

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <MapPin size={13} strokeWidth={2} color={colors.inkFaint} />
        <Text style={styles.label}>{otherLabel.toUpperCase()} LOCATION</Text>
      </View>

      {!hasOther ? (
        <Text style={styles.note}>Waiting for the {otherLabel.toLowerCase()} to share their location…</Text>
      ) : (
        <>
          <Text style={styles.headline}>
            {distanceKm != null ? `${formatDistanceKm(distanceKm)} away` : `${otherLabel} is sharing their location`}
          </Text>
          <Text style={styles.sub}>Updated {formatRelativeTime(other.updatedAt!)}</Text>
          <Button
            title="Open in Maps"
            variant="outline"
            onPress={() => openInMaps(other.lat!, other.lng!, `${otherLabel} - ${job.title}`)}
            style={{ height: 42, marginTop: spacing.sm }}
          />
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: 4,
      ...shadow.card,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    label: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    headline: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    sub: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    note: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkMuted, lineHeight: 18 },
  });
}
