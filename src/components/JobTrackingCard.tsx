import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View, StyleSheet } from 'react-native';
import { ArrowUpRight, MapPin, MessageCircle } from 'lucide-react-native';
import { useJobLocation } from '../hooks/useJobLocation';
import { useProvider } from '../api/marketplace';
import { formatDistanceKm, formatRelativeTime, haversineKm, openInMaps } from '../lib/geo';
import { Avatar } from './Avatar';
import { fonts, radii, shadow, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import type { Job, JobStatus } from '../types/database';

const ACTIVE_JOB_STATUSES = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];

// A short, pill-sized word per status - jobStatusLabel's own sentences
// ("Confirm completion", "Awaiting customer") read fine in the progress
// card but are too long for a small map-corner badge like the reference
// image's "In Transit".
const PILL_LABEL: Record<JobStatus, string> = {
  accepted: 'READY',
  in_progress: 'IN PROGRESS',
  awaiting_completion_confirmation: 'AWAITING',
  completed: 'DONE',
};

function PulsingDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <View style={styles.pinWrap}>
      <Animated.View style={[styles.pinRing, { backgroundColor: color, opacity, transform: [{ scale }] }]} />
      <View style={[styles.pinDot, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * The one dark, map-style "tracking" frame on an otherwise white-ground
 * app - same idea as the reference shipment-tracking card the user sent,
 * adapted to what this app actually has: no map SDK (this app deliberately
 * opens the device's own Maps app instead - see openInMaps), and one
 * shared job location rather than a two-point shipment route. So the
 * "map" is a stylized dark surface with a live pulsing pin for the other
 * party's last reported position, not a real map tile.
 */
export function JobTrackingCard({
  job,
  viewerRole,
  onMessage,
}: {
  job: Job;
  viewerRole: 'customer' | 'provider';
  onMessage: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: location } = useJobLocation(job.id);
  const otherId = viewerRole === 'customer' ? job.provider_id : job.customer_id;
  const { data: other } = useProvider(otherId);

  if (!ACTIVE_JOB_STATUSES.includes(job.status)) return null;

  const otherLabel = viewerRole === 'customer' ? 'Provider' : 'Customer';
  const otherPoint =
    viewerRole === 'customer'
      ? { lat: location?.provider_lat, lng: location?.provider_lng, updatedAt: location?.provider_updated_at }
      : { lat: location?.customer_lat, lng: location?.customer_lng, updatedAt: location?.customer_updated_at };
  const myPoint =
    viewerRole === 'customer'
      ? { lat: location?.customer_lat, lng: location?.customer_lng }
      : { lat: location?.provider_lat, lng: location?.provider_lng };

  const hasOther = otherPoint.lat != null && otherPoint.lng != null;
  const hasMine = myPoint.lat != null && myPoint.lng != null;
  const distanceKm =
    hasOther && hasMine ? haversineKm({ lat: myPoint.lat!, lng: myPoint.lng! }, { lat: otherPoint.lat!, lng: otherPoint.lng! }) : null;

  const reference = `JOB-${job.id.slice(0, 8).toUpperCase()}`;
  const badgeColor = job.status === 'in_progress' ? colors.active : colors.pendingOnDark;

  return (
    <View style={styles.card}>
      <View style={styles.mapFrame}>
        <View style={styles.mapGrid}>
          {[0.25, 0.5, 0.75].map((p) => (
            <View key={`h${p}`} style={[styles.gridLineH, { top: `${p * 100}%` }]} />
          ))}
          {[0.25, 0.5, 0.75].map((p) => (
            <View key={`v${p}`} style={[styles.gridLineV, { left: `${p * 100}%` }]} />
          ))}
        </View>
        <View style={styles.mapTopRow}>
          <Text style={styles.mapEyebrow} numberOfLines={1}>{otherLabel.toUpperCase()} LOCATION</Text>
          <View style={[styles.statusPill, { backgroundColor: badgeColor }]}>
            <Text style={styles.statusPillText} numberOfLines={1}>{PILL_LABEL[job.status]}</Text>
          </View>
        </View>
        <View style={styles.mapCenter}>
          {hasOther ? (
            <PulsingDot color={colors.active} />
          ) : (
            <MapPin size={22} strokeWidth={1.8} color="rgba(255,255,255,0.35)" />
          )}
        </View>
      </View>

      <View style={styles.refRow}>
        <Text style={styles.refLabel}>JOB REFERENCE</Text>
        <Text style={styles.refValue}>{reference}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.infoLabel}>LOCATION</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{job.location_label}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.infoLabel}>DISTANCE</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {!hasOther ? 'Waiting…' : distanceKm != null ? `${formatDistanceKm(distanceKm)} away` : 'Sharing…'}
          </Text>
          {hasOther ? <Text style={styles.infoSub}>Updated {formatRelativeTime(otherPoint.updatedAt!)}</Text> : null}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.partnerRow}>
        <Avatar initials={other?.initials ?? ''} photoUrl={other?.photo_url} size={38} dim fg={colors.white} />
        <Text style={styles.partnerName} numberOfLines={1}>{other?.full_name ?? otherLabel}</Text>
        <Pressable style={styles.partnerAction} onPress={onMessage} accessibilityRole="button" accessibilityLabel={`Message ${otherLabel.toLowerCase()}`}>
          <MessageCircle size={16} strokeWidth={2.2} color={colors.white} />
        </Pressable>
      </View>

      {hasOther ? (
        <Pressable
          style={({ pressed }) => [styles.ctaPill, pressed && styles.ctaPillPressed]}
          onPress={() => openInMaps(otherPoint.lat!, otherPoint.lng!, `${otherLabel} - ${job.title}`)}
        >
          <Text style={styles.ctaPillText}>Open in Maps</Text>
          <ArrowUpRight size={16} strokeWidth={2.4} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pinRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  pinDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
});

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.ink,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    mapFrame: {
      height: 128,
      borderRadius: radii.xl,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      padding: spacing.md,
      overflow: 'hidden',
    },
    mapGrid: { ...styleAbsoluteFill },
    gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
    gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
    mapTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
    mapEyebrow: { flexShrink: 1, color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: fonts.extrabold, letterSpacing: 0.6 },
    statusPill: { flexShrink: 0, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radii.pill },
    statusPillText: { color: colors.white, fontSize: 9.5, fontFamily: fonts.extrabold, letterSpacing: 0.4 },
    mapCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    refRow: { alignItems: 'center', gap: 3 },
    refLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: fonts.extrabold, letterSpacing: 0.6 },
    refValue: { color: colors.white, fontSize: 16, fontFamily: fonts.mono, fontWeight: '700', letterSpacing: 0.5 },

    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },

    infoRow: { flexDirection: 'row' },
    infoLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: fonts.extrabold, letterSpacing: 0.5 },
    infoValue: { color: colors.white, fontSize: 13.5, fontFamily: fonts.semibold },
    infoSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: fonts.medium },

    partnerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    partnerName: { flex: 1, color: colors.white, fontSize: 13.5, fontFamily: fonts.bold },
    partnerAction: {
      width: 34,
      height: 34,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
    },

    ctaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 46,
      borderRadius: radii.pill,
      backgroundColor: colors.active,
    },
    ctaPillPressed: { opacity: 0.9 },
    ctaPillText: { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
  });
}

const styleAbsoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
