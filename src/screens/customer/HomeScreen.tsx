import { useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { ArrowUpRight, ChevronRight, ListFilter, MapPin, Search, ShieldCheck, Star } from 'lucide-react-native';
import { useAllProviders, useCategories } from '../../api/marketplace';
import { useMyActiveRequest } from '../../api/requests';
import { useCustomerActiveJob } from '../../api/jobs';
import { Avatar } from '../../components/Avatar';
import { CategoryGridTile } from '../../components/CategoryTile';
import { FilterChips } from '../../components/FilterChips';
import type { FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const PROVIDER_FILTERS: FilterOption[] = [
  { id: 'all', label: 'All', icon: ListFilter },
  { id: 'verified', label: 'Verified', icon: ShieldCheck },
  { id: 'top_rated', label: 'Top rated', icon: Star },
  { id: 'nearby', label: 'Nearby', icon: MapPin },
];

// Preview count shown on Home; "View all" leads to the full, unlimited list.
const PROVIDER_PREVIEW_COUNT = 6;

export function HomeScreen({ navigation }: { navigation: any }) {
  const { colors, scheme } = useTheme();
  const styles = makeStyles(colors);
  const activityEyebrowColor = scheme === 'dark' ? colors.pendingOnDark : colors.pending;
  const activityFillColor = scheme === 'dark' ? colors.confirmOnDark : colors.confirm;
  const profile = useSessionStore((s) => s.profile);
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  // The full, unfiltered set - useTopProviders() caps at 3, which made the
  // filter chips look broken (filtering 3 items rarely leaves anything).
  const { data: providers = [], refetch: refetchProviders } = useAllProviders(null, profile?.area ?? null);
  const { data: activeRequest, refetch: refetchRequest } = useMyActiveRequest(profile?.id ?? null);
  const { data: activeJob, refetch: refetchJob } = useCustomerActiveJob(profile?.id ?? null);
  const [providerFilter, setProviderFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetchCategories(), refetchProviders(), refetchRequest(), refetchJob()]);
  });

  const filteredProviders = useMemo(() => {
    const filtered = (() => {
      switch (providerFilter) {
        case 'verified':
          return providers.filter((p) => p.provider_verified);
        case 'top_rated':
          return providers.filter((p) => p.provider_rating >= 4.5);
        case 'nearby':
          return providers.filter((p) => (p.provider_distance_km ?? Infinity) <= 5);
        default:
          return providers;
      }
    })();
    return filtered.slice(0, PROVIDER_PREVIEW_COUNT);
  }, [providers, providerFilter]);

  function handleSearchSubmit() {
    navigation.navigate('NewRequest', searchText.trim() ? { initialDescription: searchText.trim() } : undefined);
  }
  const activeJobIsLive =
    !!activeJob &&
    (activeJob.status === 'accepted' ||
      activeJob.status === 'in_progress' ||
      activeJob.status === 'awaiting_completion_confirmation');
  const hasActiveRequest =
    !activeJobIsLive &&
    !!activeRequest &&
    !['completed', 'cancelled', 'accepted'].includes(activeRequest.status);
  const requestStatus = (() => {
    if (!activeRequest || !hasActiveRequest) return null;
    if (activeRequest.status === 'quoted' && activeRequest.quotes.length) {
      return {
        eyebrow: 'QUOTES READY',
        title: `${activeRequest.quotes.length} ${activeRequest.quotes.length === 1 ? 'quote' : 'quotes'} for ${activeRequest.category_label}`,
        detail: 'Compare verified providers and choose who to hire.',
        action: 'Review quotes',
      };
    }
    if (activeRequest.status === 'awaiting_provider') {
      return null;
    }
    if (activeRequest.status === 'rejected') {
      return {
        eyebrow: 'REQUEST DECLINED',
        title: activeRequest.category_label,
        detail: activeRequest.rejection_reason ?? 'The provider declined this request.',
        action: 'View details',
      };
    }
    return {
      eyebrow: 'REQUEST IN PROGRESS',
      title: activeRequest.category_label,
      detail: 'We’re matching you with verified providers nearby.',
      action: 'View request',
    };
  })();

  return (
    <Screen edges={['top']} bg={colors.paper}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGreetRow}>
            <View style={styles.heroGreetText}>
              <Text style={styles.heroGreeting}>Good morning, {firstName}</Text>
              <Text style={styles.heroLocation}>{profile?.area ?? 'Accra'}</Text>
            </View>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.headerAvatarImage} />
            ) : (
              <Avatar initials={firstName.charAt(0).toUpperCase()} size={38} />
            )}
          </View>

          <View style={styles.heroSearch}>
            <Search color={colors.inkFaint} size={18} strokeWidth={2} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearchSubmit}
              placeholder="What do you need help with?"
              placeholderTextColor={colors.inkFaint}
              returnKeyType="search"
              style={styles.heroSearchInput}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.heroCta, pressed && styles.heroCtaPressed]}
            onPress={() => navigation.navigate('NewRequest')}
          >
            <Text style={styles.heroCtaLabel}>Start a request</Text>
            <ArrowUpRight color={colors.paper} size={18} strokeWidth={2.4} />
          </Pressable>

          {activeJobIsLive ? (
            <Pressable
              style={({ pressed }) => [styles.heroActivity, pressed && styles.heroActivityPressed]}
              onPress={() => navigation.navigate('JobsTab', { screen: 'JobDetail', params: { jobId: activeJob.id } })}
              accessibilityRole="button"
              accessibilityLabel={`View active job: ${activeJob.title}`}
            >
              <View style={styles.heroActivityTopRow}>
                <Text style={[styles.heroActivityEyebrow, { color: activityEyebrowColor }]}>
                  {activeJob.status === 'awaiting_completion_confirmation'
                    ? 'CONFIRM COMPLETION'
                    : activeJob.status === 'accepted'
                      ? 'JOB READY'
                      : 'JOB IN PROGRESS'}
                </Text>
                <View style={styles.heroActivityAction}>
                  <Text style={styles.heroActivityActionText}>Track job</Text>
                  <ChevronRight color={colors.ink} size={13} strokeWidth={2.5} />
                </View>
              </View>
              <Text style={styles.heroActivityTitle}>{activeJob.title}</Text>
              <Text style={styles.heroActivityDetail}>
                {activeJob.status === 'awaiting_completion_confirmation'
                  ? 'Provider finished · confirm to release payment'
                  : activeJob.status === 'accepted'
                    ? 'Waiting for provider to start'
                    : `In progress · ${activeJob.location_label}`}
              </Text>
            </Pressable>
          ) : hasActiveRequest && requestStatus ? (
            <Pressable
              style={({ pressed }) => [styles.heroActivity, pressed && styles.heroActivityPressed]}
              onPress={() => navigation.navigate('RequestsTab', { screen: 'RequestsHome' })}
              accessibilityRole="button"
              accessibilityLabel={`${requestStatus.action}: ${requestStatus.title}`}
            >
              <View style={styles.heroActivityTopRow}>
                <Text style={[styles.heroActivityEyebrow, { color: activityEyebrowColor }]}>{requestStatus.eyebrow}</Text>
                <View style={styles.heroActivityAction}>
                  <Text style={styles.heroActivityActionText}>{requestStatus.action}</Text>
                  <ChevronRight color={colors.ink} size={13} strokeWidth={2.5} />
                </View>
              </View>
              <Text style={styles.heroActivityTitle}>{requestStatus.title}</Text>
              <Text style={styles.heroActivityDetail}>{requestStatus.detail}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Choose a category</Text>
          <Text style={styles.sectionCount}>{categories.length} available</Text>
        </View>

        <View style={styles.categoryCard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categories.map((category) => (
              <CategoryGridTile
                key={category.id}
                id={category.id}
                abbr={category.abbr}
                name={category.name}
                description={category.default_label}
                selected={false}
                compact
                onPress={() =>
                  navigation.navigate('NewRequest', {
                    initialCategoryId: category.id,
                    initialCategoryName: category.name,
                  })
                }
              />
            ))}
          </ScrollView>
        </View>

        <View style={[styles.sectionHeading, styles.providerHeading]}>
          <Text style={styles.sectionTitle}>Top rated nearby</Text>
          <Pressable onPress={() => navigation.navigate('AllProviders')} hitSlop={10}>
            <Text style={styles.seeAll}>View all</Text>
          </Pressable>
        </View>

        <FilterChips options={PROVIDER_FILTERS} value={providerFilter} onChange={setProviderFilter} />

        {filteredProviders.length === 0 ? (
          <View style={styles.filterEmpty}>
            <Text style={styles.filterEmptyText}>No providers match this filter right now.</Text>
          </View>
        ) : (
        <View style={styles.providerListShadow}>
        <View style={styles.providerList}>
          {filteredProviders.map((provider) => (
            <Pressable
              key={provider.id}
              style={({ pressed }) => [styles.providerRow, pressed && styles.providerRowPressed]}
              onPress={() => navigation.navigate('ProviderDetail', { providerId: provider.id })}
            >
              <Avatar initials={provider.initials} size={46} />
              <View style={styles.providerInfo}>
                <View style={styles.providerNameRow}>
                  <Text style={styles.providerName}>{provider.full_name}</Text>
                  {provider.provider_verified ? (
                    <View style={styles.verifiedStamp} accessibilityLabel="Verified">
                      <ShieldCheck size={12} strokeWidth={2.6} color={colors.confirm} />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.providerTrade} numberOfLines={1}>{provider.provider_category}</Text>
                <View style={styles.providerMetaRow}>
                  <Star color={colors.ink} fill={colors.ink} size={11} strokeWidth={2} />
                  <Text style={styles.providerMeta}>{provider.provider_rating.toFixed(1)}</Text>
                  <View style={styles.metaDot} />
                  <MapPin color={colors.inkFaint} size={11} strokeWidth={2} />
                  <Text style={styles.providerMeta}>{provider.provider_distance_km} km away</Text>
                </View>
              </View>
              <ChevronRight color={colors.inkFainter} size={18} strokeWidth={2.2} />
            </Pressable>
          ))}
        </View>
        </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.paper },
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 112, gap: spacing.xl },

    // Hero "card" - greeting, search, primary action and job/request status
    // all live on one rounded-rect surface lifted off the page by shadow
    // alone (no hairline - depth does the separating). Follows the theme:
    // white on light, dark charcoal on dark - same as every other card.
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: radii.xxxl,
      padding: spacing.lg,
      gap: spacing.lg,
      shadowColor: colors.black,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    heroGreetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerAvatarImage: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.paperDim,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    heroGreetText: { flex: 1, gap: 3 },
    heroGreeting: { color: colors.ink, fontSize: 19, letterSpacing: -0.4, fontFamily: fonts.extrabold },
    heroLocation: { color: colors.inkMuted, fontSize: 12.5, fontFamily: fonts.medium },

    heroSearch: {
      height: 48,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.paperDim,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    heroSearchInput: { flex: 1, color: colors.ink, fontSize: 14, fontFamily: fonts.medium, padding: 0 },

    heroCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.ink,
      borderRadius: radii.lg,
      height: 50,
    },
    heroCtaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
    heroCtaLabel: { color: colors.paper, fontSize: 15, fontFamily: fonts.bold },

    heroActivity: {
      padding: spacing.md,
      gap: 6,
      borderRadius: radii.lg,
      backgroundColor: colors.paperDim,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    heroActivityPressed: { backgroundColor: colors.hairline },
    heroActivityTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
    heroActivityEyebrow: { color: colors.pending, fontSize: 10, letterSpacing: 0.7, fontFamily: fonts.extrabold },
    heroActivityAction: { flexDirection: 'row', alignItems: 'center', gap: 1 },
    heroActivityActionText: { color: colors.ink, fontSize: 12.5, fontFamily: fonts.bold },
    heroActivityTitle: { color: colors.ink, fontSize: 14.5, letterSpacing: -0.2, fontFamily: fonts.bold },
    heroActivityDetail: { color: colors.inkMuted, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.medium },
    heroProgressTrack: { height: 3, marginTop: 3, borderRadius: radii.pill, overflow: 'hidden', backgroundColor: colors.hairline },
    heroProgressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.confirm },

    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    sectionTitle: { color: colors.ink, fontSize: 16.5, letterSpacing: -0.3, fontFamily: fonts.bold },
    sectionCount: { color: colors.inkFaint, fontSize: 12, fontFamily: fonts.medium },
    providerHeading: { marginTop: 4 },
    seeAll: { color: colors.active, fontSize: 13, fontFamily: fonts.bold, textDecorationLine: 'underline' },

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
    categoryRow: { gap: spacing.md },

    filterEmpty: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
    filterEmptyText: { color: colors.inkMuted, fontSize: 13.5, fontFamily: fonts.medium },

    providerListShadow: {
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      shadowColor: colors.black,
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    providerList: { borderRadius: radii.lg, overflow: 'hidden' },
    providerRow: { minHeight: 78, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
    providerRowPressed: { backgroundColor: colors.paperDim },
    providerInfo: { flex: 1, gap: 2 },
    providerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    providerName: { color: colors.ink, fontSize: 16, fontFamily: fonts.bold },
    verifiedStamp: { alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: radii.pill, backgroundColor: colors.confirmBg },
    providerTrade: { color: colors.inkMuted, fontSize: 13, fontFamily: fonts.medium },
    providerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    providerMeta: { color: colors.inkFaint, fontSize: 12.5, fontFamily: fonts.medium, marginRight: 4 },
    metaDot: { width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: colors.inkFainter, marginHorizontal: 1 },
  });
}
