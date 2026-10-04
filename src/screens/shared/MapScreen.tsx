import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Eye, EyeOff, LocateFixed, MapPin, ShieldCheck, Star, X } from 'lucide-react-native';
import { useCustomerActiveJob, useProviderJobs } from '../../api/jobs';
import { useMapProviders, type MapProviderRow } from '../../api/map';
import { useCategories, useProvider } from '../../api/marketplace';
import { coordsForLabel } from '../../api/location';
import { useFeedRequests, type FeedItem } from '../../api/requests';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { ServiceMap, type MapPin as Pin, type ServiceMapHandle } from '../../components/ServiceMap';
import { useJobLocation } from '../../hooks/useJobLocation';
import { useMyAvailabilityMode } from '../../hooks/useMyAvailabilityMode';
import { useMyPosition } from '../../hooks/useMyPosition';
import { formatRelativeTime } from '../../lib/geo';
import { isFresh, isLiveJobStatus, roundBounds, spreadAroundCentroid, type MapBounds } from '../../lib/mapPins';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Job } from '../../types/database';

// Matches map_providers' own cut-off; used here for the hired party's exact
// live pin, which comes from job_locations instead.
const LIVE_MAX_AGE_MS = 10 * 60_000;

function shortCategory(label: string) {
  return label.split('·').pop()?.trim() || label;
}

/** The hired party's exact live position during an active job, as a pin.
 * Only the job's own customer and provider can read job_locations (0024). */
function useLiveJobPin(job: Job | null, role: 'customer' | 'provider'): Pin | null {
  const { data: loc } = useJobLocation(job?.id ?? null);
  if (!job || !loc) return null;
  const lat = role === 'customer' ? loc.provider_lat : loc.customer_lat;
  const lng = role === 'customer' ? loc.provider_lng : loc.customer_lng;
  const at = role === 'customer' ? loc.provider_updated_at : loc.customer_updated_at;
  if (lat == null || lng == null || !isFresh(at, LIVE_MAX_AGE_MS)) return null;
  return { kind: 'live', id: `job:${job.id}`, lat, lng, label: role === 'customer' ? 'Your pro' : 'Customer' };
}

export function MapScreen({ navigation, role }: { navigation: any; role: 'customer' | 'provider' }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const userId = profile?.id ?? null;
  const mapRef = useRef<ServiceMapHandle>(null);
  const { data: me } = useMyPosition();
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState('all');

  // Customer layers.
  const { data: categories = [] } = useCategories();
  const providersQuery = useMapProviders(bounds, category === 'all' ? null : category, role === 'customer');
  const { data: customerJob } = useCustomerActiveJob(role === 'customer' ? userId : null);

  // Provider layers.
  const { data: feed = [], isLoading: feedLoading } = useFeedRequests(role === 'provider' ? userId : null);
  const { data: providerJobs = [] } = useProviderJobs(role === 'provider' ? userId : null);

  const activeJob: Job | null =
    role === 'customer'
      ? customerJob && isLiveJobStatus(customerJob.status)
        ? customerJob
        : null
      : providerJobs.find((j) => isLiveJobStatus(j.status)) ?? null;
  const livePin = useLiveJobPin(activeJob, role);
  const { data: otherParty } = useProvider(
    activeJob ? (role === 'customer' ? activeJob.provider_id : activeJob.customer_id) : null,
  );

  const providers = role === 'customer' ? providersQuery.data ?? [] : [];
  const requestPins = useMemo(() => {
    if (role !== 'provider') return [] as Array<{ pin: Pin; request: FeedItem }>;
    const out: Array<{ pin: Pin; request: FeedItem }> = [];
    for (const r of feed) {
      const centroid = coordsForLabel(r.location_label);
      if (!centroid) continue;
      const p = spreadAroundCentroid(r.id, centroid);
      const budget = r.customer_budget ?? r.budget_min;
      out.push({
        request: r,
        pin: { kind: 'request', id: r.id, lat: p.lat, lng: p.lng, label: budget != null ? `GHS ${budget.toLocaleString()}` : shortCategory(r.category_label) },
      });
    }
    return out;
  }, [role, feed]);

  const pins = useMemo(() => {
    const list: Pin[] =
      role === 'customer'
        ? providers.map((p) => ({ kind: 'provider' as const, id: p.id, lat: p.lat, lng: p.lng, rating: p.provider_rating, verified: p.provider_verified }))
        : requestPins.map((r) => r.pin);
    if (livePin) list.push(livePin);
    return list;
  }, [role, providers, requestPins, livePin]);

  const selectedProvider: MapProviderRow | null =
    role === 'customer' ? providers.find((p) => p.id === selectedId) ?? null : null;
  const selectedRequest: FeedItem | null =
    role === 'provider' ? requestPins.find((r) => r.request.id === selectedId)?.request ?? null : null;
  const selectedLive = !!livePin && selectedId === livePin.id;

  const categoryOptions: FilterOption[] = useMemo(
    () => [{ id: 'all', label: 'All' }, ...categories.map((c) => ({ id: c.name, label: c.name }))],
    [categories],
  );

  const count = role === 'customer' ? providers.length : requestPins.length;
  const loading = role === 'customer' ? providersQuery.isLoading && !!bounds : feedLoading;
  const summary =
    role === 'customer'
      ? `${count} ${count === 1 ? 'pro' : 'pros'} available now in view`
      : `${count} open ${count === 1 ? 'request' : 'requests'} near you`;

  function openActiveJob() {
    if (!activeJob) return;
    navigation.navigate('ActivityTab', { screen: 'JobDetail', params: { jobId: activeJob.id } });
  }

  return (
    <Screen>
      <View style={styles.fill}>
        <ServiceMap
          ref={mapRef}
          pins={pins}
          me={me ?? null}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onBoundsChange={(b) => setBounds(roundBounds(b))}
        />

        <View style={styles.top} pointerEvents="box-none">
          <View style={styles.headerCard}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>Map</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {summary}
              </Text>
            </View>
            {loading ? <ActivityIndicator color={colors.ink} /> : null}
          </View>

          {role === 'customer' ? (
            <View>
              <FilterChips
                options={categoryOptions}
                value={category}
                onChange={(id) => {
                  setCategory(id);
                  setSelectedId(null);
                }}
              />
            </View>
          ) : (
            <VisibilityBanner onPress={() => navigation.navigate('ProfileTab', { screen: 'Availability' })} />
          )}
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {me ? (
            <Pressable
              style={({ pressed }) => [styles.locateBtn, pressed && styles.pressed]}
              onPress={() => mapRef.current?.centerOn(me, 14)}
              accessibilityRole="button"
              accessibilityLabel="Center the map on my location"
            >
              <LocateFixed size={18} strokeWidth={2.2} color={colors.ink} />
            </Pressable>
          ) : null}

          {selectedProvider ? (
            <View style={styles.sheet}>
              <View style={styles.sheetRow}>
                <Avatar initials={selectedProvider.initials} photoUrl={selectedProvider.photo_url} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>
                      {selectedProvider.full_name}
                    </Text>
                    {selectedProvider.provider_verified ? (
                      <ShieldCheck size={15} strokeWidth={2.4} color={colors.confirm} />
                    ) : null}
                  </View>
                  <Text style={styles.sheetMeta} numberOfLines={1}>
                    {shortCategory(selectedProvider.provider_category ?? 'Provider')}
                  </Text>
                  <View style={styles.nameRow}>
                    <Star size={12} strokeWidth={2.4} color={colors.active} fill={colors.active} />
                    <Text style={styles.sheetMeta}>
                      {selectedProvider.provider_rating.toFixed(1)} · {selectedProvider.provider_jobs_count} jobs · seen{' '}
                      {formatRelativeTime(selectedProvider.updated_at)}
                    </Text>
                  </View>
                </View>
                <CloseButton onPress={() => setSelectedId(null)} />
              </View>
              <Button
                title="View profile"
                onPress={() => navigation.navigate('HomeTab', { screen: 'ProviderDetail', params: { providerId: selectedProvider.id } })}
              />
            </View>
          ) : selectedRequest ? (
            <View style={styles.sheet}>
              <View style={styles.sheetRow}>
                <View style={styles.pinIcon}>
                  <MapPin size={18} strokeWidth={2.2} color={colors.ink} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {shortCategory(selectedRequest.category_label)}
                  </Text>
                  <Text style={styles.sheetMeta} numberOfLines={1}>
                    {selectedRequest.location_label} · {formatRelativeTime(selectedRequest.created_at)}
                  </Text>
                  {selectedRequest.myQuote ? <Text style={styles.sheetMeta}>You've already quoted</Text> : null}
                </View>
                {(selectedRequest.customer_budget ?? selectedRequest.budget_min) != null ? (
                  <Text style={styles.budget}>
                    GHS {(selectedRequest.customer_budget ?? selectedRequest.budget_min)!.toLocaleString()}
                  </Text>
                ) : null}
                <CloseButton onPress={() => setSelectedId(null)} />
              </View>
              <Text style={styles.note}>Shown at the neighbourhood, not the customer's address.</Text>
              <Button
                title={selectedRequest.myQuote ? 'View request' : 'View & quote'}
                onPress={() =>
                  navigation.navigate('FeedTab', { screen: 'RequestDetail', params: { requestId: selectedRequest.id } })
                }
              />
            </View>
          ) : activeJob ? (
            <Pressable style={({ pressed }) => [styles.sheet, pressed && styles.pressed]} onPress={openActiveJob}>
              <View style={styles.sheetRow}>
                <Avatar initials={otherParty?.initials ?? ''} photoUrl={otherParty?.photo_url} size={40} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {activeJob.title}
                  </Text>
                  <Text style={styles.sheetMeta} numberOfLines={1}>
                    {livePin
                      ? `${otherParty?.full_name ?? (role === 'customer' ? 'Your pro' : 'Customer')} is live on the map`
                      : 'Waiting for a live location'}
                  </Text>
                </View>
                {livePin && !selectedLive ? (
                  <Pressable
                    onPress={() => {
                      setSelectedId(livePin.id);
                      mapRef.current?.centerOn(livePin, 15);
                    }}
                    style={styles.showBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.showBtnText}>Show</Text>
                  </Pressable>
                ) : (
                  <ChevronRight size={18} strokeWidth={2} color={colors.inkFaint} />
                )}
              </View>
            </Pressable>
          ) : !loading && count === 0 ? (
            <View style={styles.emptyHint}>
              <Text style={styles.emptyText}>
                {role === 'customer'
                  ? 'No pros are available right now in this area. Zoom out or try another category.'
                  : 'No open requests near you right now. New ones also appear in your Feed.'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

/** Tells a provider whether customers can currently see them on the map. */
function VisibilityBanner({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const availability = useMyAvailabilityMode();
  const visible = availability === 'AVAILABLE_NOW';
  return (
    <Pressable style={styles.visibility} onPress={onPress} accessibilityRole="button">
      {visible ? (
        <Eye size={16} strokeWidth={2.2} color={colors.confirm} />
      ) : (
        <EyeOff size={16} strokeWidth={2.2} color={colors.inkMuted} />
      )}
      <Text style={styles.visibilityText} numberOfLines={2}>
        {visible
          ? 'Customers can see you on the map (approximate area only, never your exact spot).'
          : 'You\'re hidden from customers. Set "Available now" to appear on the map.'}
      </Text>
      <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
    </Pressable>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
      <X size={18} strokeWidth={2.2} color={colors.inkFaint} />
    </Pressable>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    fill: { flex: 1 },
    pressed: { opacity: 0.9 },
    top: { position: 'absolute', top: spacing.sm, left: spacing.lg, right: spacing.lg, gap: spacing.sm },
    headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      ...shadow.card,
    },
    title: { fontSize: fontSizes.xl, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4 },
    subtitle: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkMuted },
    visibility: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      ...shadow.card,
    },
    visibilityText: { flex: 1, fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.ink },

    bottom: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md, gap: spacing.sm },
    locateBtn: {
      alignSelf: 'flex-end',
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      ...shadow.card,
    },
    sheet: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sheetTitle: { flexShrink: 1, fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    sheetMeta: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkMuted },
    budget: { fontSize: fontSizes.md, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
    note: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    pinIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
    },
    showBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.ink },
    showBtnText: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.white },
    emptyHint: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      ...shadow.card,
    },
    emptyText: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkMuted, textAlign: 'center' },
  });
}
