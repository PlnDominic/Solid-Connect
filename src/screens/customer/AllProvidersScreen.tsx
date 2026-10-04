import { useEffect, useMemo, useState } from 'react';
import { Heart, Search, Star } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { useCategories, useProvidersByIds } from '../../api/marketplace';
import { useProviderSearch } from '../../api/providerSearch';
import { useIsProviderSaved, useToggleSavedProvider } from '../../api/saved';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ToggleChips } from '../../components/ToggleChips';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useRecentlyViewedProviderIds } from '../../hooks/useRecentlyViewedProviders';
import { formatDistanceKm } from '../../lib/geo';
import { applyProviderFilters, matchReasons, sortProviders, type SearchProvider, type SortKey } from '../../lib/providerRanking';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const RATING_OPTIONS: FilterOption[] = [
  { id: 'any', label: 'Any rating' },
  { id: '4', label: '4.0+' },
  { id: '4.5', label: '4.5+' },
];

const DISTANCE_OPTIONS: FilterOption[] = [
  { id: 'any', label: 'Any distance' },
  { id: '2', label: '2 km' },
  { id: '5', label: '5 km' },
  { id: '10', label: '10 km' },
  { id: '25', label: '25 km' },
];

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'best', label: 'Best match' },
  { id: 'nearest', label: 'Nearest' },
  { id: 'rating', label: 'Top rated' },
  { id: 'jobs', label: 'Most jobs' },
];

/** Providers rendered per page as the user scrolls - keeps the list light
 * on low-end Androids even when a category has hundreds of providers. */
const PAGE_SIZE = 20;
/** Hard cap on rows fetched from Supabase/Nest for the browse list. */
const MAX_FETCH = 400;

function ProviderRow({
  provider,
  customerId,
  onOpen,
}: {
  provider: SearchProvider;
  customerId: string;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: saved = false } = useIsProviderSaved(customerId, provider.id);
  const toggleSaved = useToggleSavedProvider();
  const reasons = matchReasons(provider);
  // Real distance when we have it; otherwise the profile's stored figure.
  const distanceKm = provider.distance_km ?? provider.stored_distance_km;

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <Avatar initials={provider.initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name} numberOfLines={1}>{provider.full_name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{provider.provider_category} ·</Text>
          <Star color={colors.ink} fill={colors.ink} size={10} strokeWidth={2} />
          <Text style={styles.meta}>
            {provider.provider_rating.toFixed(1)}
            {distanceKm != null ? ` · ${formatDistanceKm(distanceKm)}` : ''}
          </Text>
        </View>
        {reasons.length ? (
          <View style={styles.reasonRow}>
            {reasons.map((r) => (
              <View key={r} style={styles.reasonChip}>
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Pressable
        hitSlop={10}
        onPress={() => toggleSaved.mutate({ customerId, providerId: provider.id, saved })}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved providers' : 'Save this provider'}
        accessibilityState={{ selected: saved }}
      >
        <Heart
          size={18}
          strokeWidth={2}
          color={saved ? colors.favorite : colors.inkFaint}
          fill={saved ? colors.favorite : 'transparent'}
        />
      </Pressable>
    </Pressable>
  );
}

export function AllProvidersScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [minRating, setMinRating] = useState('any');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableNow, setAvailableNow] = useState(false);
  const [maxDistance, setMaxDistance] = useState('any');
  const [sort, setSort] = useState<SortKey>('best');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: categories = [] } = useCategories();
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const {
    providers,
    origin,
    hasDistances,
    isLoading: providersLoading,
    refetch,
  } = useProviderSearch({
    categoryName: selectedCategory?.name ?? null,
    profileArea: profile?.area ?? null,
    limit: MAX_FETCH,
  });
  const { refreshing, onRefresh } = usePullToRefresh(refetch);
  // Distance controls only mean something when real distances exist.
  const canFilterByDistance = hasDistances;

  const recentIds = useRecentlyViewedProviderIds();
  const { data: recentlyViewed = [] } = useProvidersByIds(recentIds);

  const categoryOptions: FilterOption[] = useMemo(
    () => [{ id: 'all', label: 'All trades' }, ...categories.map((c) => ({ id: c.id, label: c.name }))],
    [categories],
  );

  const filtersActive =
    minRating !== 'any' || verifiedOnly || availableNow || (canFilterByDistance && maxDistance !== 'any');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matched = needle
      ? providers.filter(
          (p) =>
            p.full_name.toLowerCase().includes(needle) || (p.provider_category ?? '').toLowerCase().includes(needle),
        )
      : providers;
    const narrowed = applyProviderFilters(matched, {
      minRating: minRating === 'any' ? 0 : Number(minRating),
      verifiedOnly,
      availableNow,
      maxDistanceKm: canFilterByDistance && maxDistance !== 'any' ? Number(maxDistance) : null,
    });
    // "Nearest" is meaningless with no distances; fall back to best match.
    return sortProviders(narrowed, sort === 'nearest' && !canFilterByDistance ? 'best' : sort);
  }, [providers, search, minRating, verifiedOnly, availableNow, maxDistance, canFilterByDistance, sort]);

  function clearFilters() {
    setMinRating('any');
    setVerifiedOnly(false);
    setAvailableNow(false);
    setMaxDistance('any');
  }

  /** Only ever grows on scroll; any filter/search/data change resets it. */
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, categoryId, minRating, verifiedOnly, availableNow, maxDistance, sort, providers]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const showRecentlyViewed =
    !search.trim() && categoryId === 'all' && !filtersActive && recentlyViewed.length > 0;

  const originNote =
    origin?.source === 'device'
      ? 'Distances are from your location.'
      : origin?.source === 'area' && profile?.area
        ? `Distances are from ${profile.area.split(',')[0]}.`
        : null;

  const renderProvider = ({ item }: { item: SearchProvider }) =>
    profile ? (
      <ProviderRow
        provider={item}
        customerId={profile.id}
        onOpen={() => navigation.navigate('ProviderDetail', { providerId: item.id })}
      />
    ) : null;

  return (
    <Screen>
      <ScreenHeader title="All providers" onBack={() => navigation.goBack()} />
      <View style={styles.filters}>
        <View style={styles.searchRow}>
          <Search size={16} strokeWidth={2} color={colors.inkFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or trade"
            placeholderTextColor={colors.inkFainter}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <FilterChips options={categoryOptions} value={categoryId} onChange={setCategoryId} />
        <FilterChips options={RATING_OPTIONS} value={minRating} onChange={setMinRating} />
        <ToggleChips
          options={[
            { id: 'verified', label: 'Verified only', on: verifiedOnly },
            { id: 'available', label: 'Available now', on: availableNow },
          ]}
          onToggle={(id) => (id === 'verified' ? setVerifiedOnly((v) => !v) : setAvailableNow((v) => !v))}
        />
        {canFilterByDistance ? (
          <FilterChips options={DISTANCE_OPTIONS} value={maxDistance} onChange={setMaxDistance} />
        ) : null}
        <FilterChips
          options={SORT_OPTIONS.filter((o) => o.id !== 'nearest' || canFilterByDistance)}
          value={sort}
          onChange={(id) => setSort(id as SortKey)}
        />
        {originNote ? <Text style={styles.originNote}>{originNote}</Text> : null}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        renderItem={renderProvider}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          showRecentlyViewed ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sectionLabel}>RECENTLY VIEWED</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {recentlyViewed.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.recentCard}
                    onPress={() => navigation.navigate('ProviderDetail', { providerId: p.id })}
                  >
                    <Avatar initials={p.initials} size={40} />
                    <Text style={styles.recentName} numberOfLines={1}>{p.full_name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        ListEmptyComponent={
          providersLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : filtered.length ? null : providers.length ? (
            <EmptyState
              title="No matches"
              subtitle="Try a different search or trade, or loosen your filters."
              action={filtersActive ? { label: 'Clear filters', onPress: clearFilters } : undefined}
            />
          ) : (
            <EmptyState title="No providers yet" subtitle="Check back soon - new providers are joining Solid Connect." />
          )
        }
        ListFooterComponent={
          hasMore ? (
            <Pressable
              style={styles.moreButton}
              onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}
              accessibilityRole="button"
              accessibilityLabel="Load more providers"
            >
              <Text style={styles.moreText}>Load more providers</Text>
            </Pressable>
          ) : null
        }
        onEndReached={() => hasMore && setVisibleCount((n) => n + PAGE_SIZE)}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      />
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: 44,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
    },
    searchInput: { flex: 1, fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.ink },
    body: { padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 },
    loadingWrap: { paddingVertical: spacing.xxl, alignItems: 'center' },
    sectionLabel: { fontSize: fontSizes.xs, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.5 },
    recentCard: {
      width: 84,
      alignItems: 'center',
      gap: 6,
      padding: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    recentName: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, color: colors.ink, textAlign: 'center' },
    card: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    name: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    reasonChip: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: radii.pill, backgroundColor: colors.paperDim },
    reasonText: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, color: colors.inkMuted },
    originNote: { fontSize: fontSizes.xs, fontFamily: fonts.medium, color: colors.inkFaint },
    moreButton: {
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    moreText: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.ink },
  });
}
