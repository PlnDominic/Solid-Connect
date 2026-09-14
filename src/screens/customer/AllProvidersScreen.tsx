import { useMemo, useState } from 'react';
import { Heart, Search, Star } from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useAllProviders, useCategories, useProvidersByIds } from '../../api/marketplace';
import { useIsProviderSaved, useToggleSavedProvider } from '../../api/saved';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { FilterChips, type FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useRecentlyViewedProviderIds } from '../../hooks/useRecentlyViewedProviders';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Profile } from '../../types/database';

const RATING_OPTIONS: FilterOption[] = [
  { id: 'any', label: 'Any rating' },
  { id: '4', label: '4.0+' },
  { id: '4.5', label: '4.5+' },
];

function ProviderRow({
  provider,
  customerId,
  onOpen,
}: {
  provider: Profile;
  customerId: string;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: saved = false } = useIsProviderSaved(customerId, provider.id);
  const toggleSaved = useToggleSavedProvider();

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <Avatar initials={provider.initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name} numberOfLines={1}>{provider.full_name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{provider.provider_category} ·</Text>
          <Star color={colors.ink} fill={colors.ink} size={10} strokeWidth={2} />
          <Text style={styles.meta}>{provider.provider_rating.toFixed(1)} · {provider.provider_distance_km} km</Text>
        </View>
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
          color={saved ? colors.ink : colors.inkFaint}
          fill={saved ? colors.ink : 'transparent'}
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

  const { data: categories = [] } = useCategories();
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const { data: providers = [], isLoading: providersLoading, refetch } = useAllProviders(
    selectedCategory?.name ?? null,
    profile?.area ?? null,
  );
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  const recentIds = useRecentlyViewedProviderIds();
  const { data: recentlyViewed = [] } = useProvidersByIds(recentIds);

  const categoryOptions: FilterOption[] = useMemo(
    () => [{ id: 'all', label: 'All trades' }, ...categories.map((c) => ({ id: c.id, label: c.name }))],
    [categories],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const minRatingValue = minRating === 'any' ? 0 : Number(minRating);
    return providers.filter((p) => {
      if (p.provider_rating < minRatingValue) return false;
      if (!needle) return true;
      return (
        p.full_name.toLowerCase().includes(needle) ||
        (p.provider_category ?? '').toLowerCase().includes(needle)
      );
    });
  }, [providers, search, minRating]);

  const showRecentlyViewed = !search.trim() && categoryId === 'all' && minRating === 'any' && recentlyViewed.length > 0;

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
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {showRecentlyViewed ? (
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
        ) : null}

        {providersLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : filtered.length ? (
          filtered.map((p) =>
            profile ? (
              <ProviderRow
                key={p.id}
                provider={p}
                customerId={profile.id}
                onOpen={() => navigation.navigate('ProviderDetail', { providerId: p.id })}
              />
            ) : null
          )
        ) : providers.length ? (
          <EmptyState title="No matches" subtitle="Try a different search, trade, or rating filter." />
        ) : (
          <EmptyState title="No providers yet" subtitle="Check back soon - new providers are joining Solid Connect." />
        )}
      </ScrollView>
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
    searchInput: { flex: 1, fontSize: 14.5, fontFamily: fonts.medium, color: colors.ink },
    body: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
    loadingWrap: { paddingVertical: spacing.xxl, alignItems: 'center' },
    sectionLabel: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.5 },
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
    recentName: { fontSize: 11.5, fontFamily: fonts.semibold, color: colors.ink, textAlign: 'center' },
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
    name: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
