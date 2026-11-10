import { useMemo, useState } from 'react';
import { ratingLabel } from '../../lib/rating';
import { ActivityIndicator, Image, Keyboard, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import {
  ArrowUpRight,
  Briefcase,
  ChevronRight,
  ClipboardList,
  CornerDownLeft,
  ListFilter,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react-native';
import { useAllProviders, useCategories } from '../../api/marketplace';
import { useMyJobPosts } from '../../api/jobPosts';
import { PromoBanner } from '../../components/PromoBanner';
import { usePortfolioPhotos } from '../../api/portfolio';
import { useMyActiveRequest } from '../../api/requests';
import { useCustomerActiveJob } from '../../api/jobs';
import { Avatar } from '../../components/Avatar';
import { CategoryGridTile } from '../../components/CategoryTile';
import { FilterChips } from '../../components/FilterChips';
import type { FilterOption } from '../../components/FilterChips';
import { Screen } from '../../components/Screen';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useGreeting, useLocale } from '../../i18n';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Category, Profile } from '../../types/database';

const PROVIDER_FILTERS: FilterOption[] = [
  { id: 'all', label: 'All', icon: ListFilter },
  { id: 'verified', label: 'Verified', icon: ShieldCheck },
  { id: 'top_rated', label: 'Top rated', icon: Star },
  { id: 'nearby', label: 'Nearby', icon: MapPin },
];

// Preview count shown on Home; "View all" leads to the full, unlimited list.
const PROVIDER_PREVIEW_COUNT = 6;
const SEARCH_PROVIDER_LIMIT = 6;
const SEARCH_CATEGORY_LIMIT = 3;

function norm(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase();
}

/** Categories whose name, label or id matches what the person typed, best first. */
function matchCategories(categories: Category[], text: string): Category[] {
  const needle = norm(text);
  if (!needle) return [];
  return categories
    .map((c) => {
      const name = norm(c.name);
      const label = norm(c.default_label);
      const id = c.id.replace(/_/g, ' ').toLowerCase();
      let score = 0;
      if (name === needle || id === needle) score = 100;
      else if (name.startsWith(needle)) score = 80;
      else if (name.includes(needle) || id.includes(needle)) score = 60;
      else if (needle.includes(name) || needle.includes(id)) score = 50;
      else if (label.includes(needle)) score = 40;
      else if (needle.split(/\s+/).some((w) => w.length >= 3 && (name.includes(w) || label.includes(w)))) score = 20;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

/** Providers whose name, trade, area or tagline contains every typed word. */
function matchProviders(providers: Profile[], text: string): Profile[] {
  const words = norm(text).split(/\s+/).filter(Boolean);
  if (!words.length) return providers;
  return providers.filter((p) => {
    const hay = `${norm(p.full_name)} ${norm(p.provider_category)} ${norm(p.area)} ${norm(p.tagline)}`;
    return words.every((w) => hay.includes(w));
  });
}

/** One "Top rated" card: the provider's single most recent portfolio
 * photo - their actual finished work, standing in for "top rated jobs"
 * since jobs themselves carry no photos of their own, only the
 * provider's portfolio does - above their name/rating, so the card reads
 * as a peek at their work rather than another plain contact-list row.
 * Falls back to a plain header when a provider has no portfolio photos
 * yet, rather than an empty gray block pretending to be one. */
function TopProviderCard({ provider, onPress }: { provider: Profile; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeCardStyles(colors);
  const { data: photos = [] } = usePortfolioPhotos(provider.id);
  const preview = photos.find((p) => p.media_type !== 'video');

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      {preview ? <Image source={{ uri: preview.photo_url }} style={styles.photoFrame} /> : null}
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Avatar initials={provider.initials} size={32} />
          <View style={styles.cardNameWrap}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName} numberOfLines={1}>{provider.full_name}</Text>
              {provider.provider_verified ? <ShieldCheck size={11} strokeWidth={2.6} color={colors.confirm} /> : null}
            </View>
            <Text style={styles.cardTrade} numberOfLines={1}>{provider.provider_category}</Text>
          </View>
        </View>
        <View style={styles.cardMetaRow}>
          <Star color={colors.active} fill={colors.active} size={10} strokeWidth={2} />
          <Text style={styles.cardMeta}>{ratingLabel(provider)}</Text>
          <View style={styles.metaDot} />
          <MapPin color={colors.inkFaint} size={10} strokeWidth={2} />
          <Text style={styles.cardMeta}>{provider.provider_distance_km} km</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: { navigation: any }) {
  const { colors, scheme } = useTheme();
  const { t } = useLocale();
  const greeting = useGreeting();
  const styles = makeStyles(colors, scheme);
  const activityEyebrowColor = scheme === 'dark' ? colors.pendingOnDark : colors.pending;
  const activityFillColor = scheme === 'dark' ? colors.confirmOnDark : colors.confirm;
  const profile = useSessionStore((s) => s.profile);
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  // The full, unfiltered set - useTopProviders() caps at 3, which made the
  // filter chips look broken (filtering 3 items rarely leaves anything).
  const { data: providers = [], isLoading: providersLoading, refetch: refetchProviders } = useAllProviders(null, profile?.area ?? null);
  const { data: activeRequest, refetch: refetchRequest } = useMyActiveRequest(profile?.id ?? null);
  const { data: activeJob, refetch: refetchJob } = useCustomerActiveJob(profile?.id ?? null);
  const [providerFilter, setProviderFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const { data: myPosts = [] } = useMyJobPosts(profile?.id ?? null);
  const openPostCount = myPosts.filter((p) => p.status === 'open').length;
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

  const categoryMatches = useMemo(
    () => matchCategories(categories, searchText).slice(0, SEARCH_CATEGORY_LIMIT),
    [categories, searchText],
  );
  const providerMatches = useMemo(
    () => matchProviders(providers, searchText).slice(0, SEARCH_PROVIDER_LIMIT),
    [providers, searchText],
  );

  function closeSearch() {
    Keyboard.dismiss();
    setSearchFocused(false);
  }

  /** The category a search most likely means: a direct category match, or
   * else the trade of the best-matching provider. */
  function bestCategoryFor(text: string): Category | null {
    const direct = matchCategories(categories, text)[0];
    if (direct) return direct;
    const trade = matchProviders(providers, text)[0]?.provider_category;
    if (!trade) return null;
    const firstTrade = trade.split('·')[0]?.trim() ?? trade;
    return matchCategories(categories, firstTrade)[0] ?? null;
  }

  function openRequestFor(category: Category | null, text: string) {
    const trimmed = text.trim();
    const isJustTheName = !!category && norm(trimmed) === norm(category.name);
    closeSearch();
    setSearchText('');
    navigation.navigate('NewRequest', {
      ...(category ? { initialCategoryId: category.id, initialCategoryName: category.name } : {}),
      ...(trimmed && !isJustTheName ? { initialDescription: trimmed } : {}),
    });
  }

  function handleSearchSubmit() {
    openRequestFor(bestCategoryFor(searchText), searchText);
  }

  function openProvider(provider: Profile) {
    closeSearch();
    navigation.navigate('ProviderDetail', { providerId: provider.id });
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
        detail: 'Compare prices, ratings and verification, then choose who to hire.',
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
    // Plain matching/open state (no quotes yet, nothing actionable) - no
    // banner rather than a "REQUEST IN PROGRESS" card with nothing to do
    // from it besides look at the same Activity tab that's always there.
    return null;
  })();

  return (
    <Screen edges={['top']} bg={colors.paper}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGreetRow}>
            <View style={styles.heroGreetText}>
              <Text style={styles.heroGreeting}>{greeting}, {firstName}</Text>
              <Text style={styles.heroLocation}>{profile?.area ?? 'Accra'}</Text>
            </View>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.headerAvatarImage} />
            ) : (
              <Avatar initials={firstName.charAt(0).toUpperCase()} size={38} />
            )}
          </View>

          <View style={[styles.heroSearch, searchFocused && styles.heroSearchFocused]}>
            <Search color={colors.white} size={18} strokeWidth={2} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => setSearchFocused(true)}
              onSubmitEditing={handleSearchSubmit}
              placeholder="What do you need help with?"
              placeholderTextColor={'rgba(255,255,255,0.72)'}
              returnKeyType="send"
              enterKeyHint="send"
              submitBehavior="blurAndSubmit"
              style={styles.heroSearchInput}
              accessibilityLabel="Search providers and services"
            />
            {searchFocused ? (
              <Pressable
                onPress={() => {
                  setSearchText('');
                  closeSearch();
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close search"
              >
                <X color={colors.white} size={18} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>

          {searchFocused ? (
            <View style={styles.dropdown}>
              {categoryMatches.length ? (
                <>
                  <Text style={styles.dropdownHeading}>SERVICES</Text>
                  {categoryMatches.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => openRequestFor(c, searchText)}
                      style={({ pressed }) => [styles.dropdownRow, pressed && styles.dropdownRowPressed]}
                    >
                      <View style={styles.dropdownIcon}>
                        <Briefcase size={15} strokeWidth={2.2} color={colors.active} />
                      </View>
                      <View style={styles.dropdownText}>
                        <Text style={styles.dropdownTitle} numberOfLines={1}>{c.name}</Text>
                        <Text style={styles.dropdownMeta} numberOfLines={1}>Start a request</Text>
                      </View>
                      <ChevronRight size={15} strokeWidth={2.4} color={colors.inkFaint} />
                    </Pressable>
                  ))}
                </>
              ) : null}

              <Text style={styles.dropdownHeading}>{searchText.trim() ? 'PROVIDERS' : 'TOP PROVIDERS'}</Text>
              {providersLoading ? (
                <ActivityIndicator color={colors.ink} style={styles.dropdownLoading} />
              ) : providerMatches.length === 0 ? (
                <Text style={styles.dropdownEmpty}>No providers match "{searchText.trim()}".</Text>
              ) : (
                providerMatches.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => openProvider(p)}
                    style={({ pressed }) => [styles.dropdownRow, pressed && styles.dropdownRowPressed]}
                  >
                    {p.photo_url ? (
                      <Image source={{ uri: p.photo_url }} style={styles.dropdownAvatar} />
                    ) : (
                      <Avatar initials={p.initials} size={32} />
                    )}
                    <View style={styles.dropdownText}>
                      <View style={styles.dropdownNameRow}>
                        <Text style={styles.dropdownTitle} numberOfLines={1}>{p.full_name}</Text>
                        {p.provider_verified ? <ShieldCheck size={12} strokeWidth={2.6} color={colors.confirm} /> : null}
                      </View>
                      <Text style={styles.dropdownMeta} numberOfLines={1}>
                        {p.provider_category ?? 'Provider'}
                        {p.provider_distance_km != null ? ` · ${p.provider_distance_km} km` : ''}
                      </Text>
                    </View>
                    <View style={styles.dropdownRating}>
                      <Star color={colors.active} fill={colors.active} size={11} strokeWidth={2} />
                      <Text style={styles.dropdownMeta}>{ratingLabel(p)}</Text>
                    </View>
                  </Pressable>
                ))
              )}

              {searchText.trim() ? (
                <Pressable
                  onPress={handleSearchSubmit}
                  style={({ pressed }) => [styles.dropdownSubmit, pressed && styles.dropdownRowPressed]}
                >
                  <CornerDownLeft size={15} strokeWidth={2.4} color={colors.active} />
                  <Text style={styles.dropdownSubmitText} numberOfLines={1}>
                    Request "{searchText.trim()}"
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {activeJobIsLive ? (
            <Pressable
              style={({ pressed }) => [styles.heroActivity, pressed && styles.heroActivityPressed]}
              onPress={() => navigation.navigate('ActivityTab', { screen: 'JobDetail', params: { jobId: activeJob.id } })}
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
                  ? 'Provider finished · confirm the job is done'
                  : activeJob.status === 'accepted'
                    ? 'Waiting for provider to start'
                    : `In progress · ${activeJob.location_label}`}
              </Text>
            </Pressable>
          ) : hasActiveRequest && requestStatus ? (
            <Pressable
              style={({ pressed }) => [styles.heroActivity, pressed && styles.heroActivityPressed]}
              onPress={() => navigation.navigate('ActivityTab', { screen: 'ActivityHome' })}
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

        {!searchFocused ? <PromoBanner onPress={() => navigation.navigate('AllProviders')} /> : null}

        <View style={styles.postJobCard}>
          <View style={styles.postJobTop}>
            <View style={styles.postJobIcon}>
              <ClipboardList size={20} strokeWidth={2.2} color={colors.active} />
            </View>
            <View style={styles.postJobText}>
              <Text style={styles.postJobTitle}>Post a Job</Text>
              <Text style={styles.postJobBody}>
                Describe the work once. Providers across Accra see it on their feed and tell you they are interested.
              </Text>
            </View>
          </View>
          <View style={styles.postJobActions}>
            <Pressable
              style={({ pressed }) => [styles.postJobPrimary, pressed && styles.pressedScale]}
              onPress={() => navigation.navigate('PostJob')}
              accessibilityRole="button"
            >
              <Text style={styles.postJobPrimaryLabel}>Post a Job</Text>
              <ArrowUpRight color={colors.white} size={16} strokeWidth={2.4} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.postJobSecondary, pressed && styles.dropdownRowPressed]}
              onPress={() => navigation.navigate('MyJobPosts')}
              accessibilityRole="button"
            >
              <Text style={styles.postJobSecondaryLabel}>
                My posts{openPostCount ? ` (${openPostCount})` : ''}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t('home.chooseCategory')}</Text>
          <Text style={styles.sectionCount}>{categories.length} available</Text>
        </View>

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
              selected={false}
              illustrated
              onPress={() =>
                navigation.navigate('NewRequest', {
                  initialCategoryId: category.id,
                  initialCategoryName: category.name,
                })
              }
            />
          ))}
        </ScrollView>

        <View style={[styles.sectionHeading, styles.providerHeading]}>
          <Text style={styles.sectionTitle}>Top rated nearby</Text>
          <Pressable onPress={() => navigation.navigate('AllProviders')} hitSlop={10}>
            <Text style={styles.seeAll}>View all</Text>
          </Pressable>
        </View>

        <FilterChips options={PROVIDER_FILTERS} value={providerFilter} onChange={setProviderFilter} />

        {providersLoading ? (
          <View style={styles.filterEmpty}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : filteredProviders.length === 0 ? (
          <View style={styles.filterEmpty}>
            <Text style={styles.filterEmptyText}>
              {providers.length ? 'No providers match this filter right now.' : 'No providers have joined near you yet.'}
            </Text>
            <Pressable onPress={() => navigation.navigate('PostJob')} hitSlop={8} accessibilityRole="button">
              <Text style={styles.seeAll}>Post a job and let providers come to you</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.providerGrid}>
            {filteredProviders.map((provider) => (
              <TopProviderCard
                key={provider.id}
                provider={provider}
                onPress={() => navigation.navigate('ProviderDetail', { providerId: provider.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors'], scheme: ReturnType<typeof useTheme>['scheme']) {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.paper },
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 112, gap: spacing.xl },

    // Hero "card" - greeting, search, primary action and job/request status
    // all live on one rounded-rect surface lifted off the page by shadow
    // alone (no hairline - depth does the separating). Follows the theme:
    // white on light, dark charcoal on dark - same as every other card.
    heroCard: {
      backgroundColor: colors.active,
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
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    heroGreetText: { flex: 1, gap: 3 },
    heroGreeting: { color: colors.white, fontSize: fontSizes.xl, letterSpacing: -0.4, fontFamily: fonts.extrabold },
    heroLocation: { color: 'rgba(255,255,255,0.82)', fontSize: fontSizes.xs, fontFamily: fonts.medium },

    heroSearch: {
      height: 48,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.34)',
    },
    heroSearchInput: { flex: 1, color: colors.white, fontSize: fontSizes.sm, fontFamily: fonts.medium, padding: 0 },

    heroSearchFocused: { backgroundColor: 'rgba(255,255,255,0.26)', borderColor: colors.white },
    pressedScale: { opacity: 0.9, transform: [{ scale: 0.99 }] },

    dropdown: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      paddingVertical: spacing.sm,
      marginTop: -spacing.sm,
      ...shadow.card,
    },
    dropdownHeading: {
      color: colors.inkFaint,
      fontSize: fontSizes.xs,
      letterSpacing: 0.8,
      fontFamily: fonts.extrabold,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: 4,
    },
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 9,
    },
    dropdownRowPressed: { backgroundColor: colors.paperDim },
    dropdownIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.paperDim : colors.activeBg,
    },
    dropdownAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.paperDim },
    dropdownText: { flex: 1, gap: 1 },
    dropdownNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dropdownTitle: { flexShrink: 1, color: colors.ink, fontSize: fontSizes.sm, fontFamily: fonts.bold },
    dropdownMeta: { color: colors.inkMuted, fontSize: fontSizes.xs, fontFamily: fonts.medium },
    dropdownRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    dropdownLoading: { paddingVertical: spacing.md },
    dropdownEmpty: {
      color: colors.inkMuted,
      fontSize: fontSizes.sm,
      fontFamily: fonts.medium,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    dropdownSubmit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    dropdownSubmitText: { flex: 1, color: colors.active, fontSize: fontSizes.sm, fontFamily: fonts.bold },

    postJobCard: {
      backgroundColor: colors.card,
      borderRadius: radii.xxxl,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      ...shadow.card,
    },
    postJobTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    postJobIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.paperDim : colors.activeBg,
    },
    postJobText: { flex: 1, gap: 3 },
    postJobTitle: { color: colors.ink, fontSize: fontSizes.lg, letterSpacing: -0.3, fontFamily: fonts.extrabold },
    postJobBody: { color: colors.inkMuted, fontSize: fontSizes.xs, lineHeight: 17, fontFamily: fonts.medium },
    postJobActions: { flexDirection: 'row', gap: spacing.sm },
    postJobPrimary: {
      flex: 1,
      height: 44,
      borderRadius: radii.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.active,
    },
    postJobPrimaryLabel: { color: colors.white, fontSize: fontSizes.sm, fontFamily: fonts.bold },
    postJobSecondary: {
      height: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
    },
    postJobSecondaryLabel: { color: colors.ink, fontSize: fontSizes.sm, fontFamily: fonts.bold },

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
    heroActivityEyebrow: { color: colors.pending, fontSize: fontSizes.xs, letterSpacing: 0.7, fontFamily: fonts.extrabold },
    heroActivityAction: { flexDirection: 'row', alignItems: 'center', gap: 1 },
    heroActivityActionText: { color: colors.ink, fontSize: fontSizes.xs, fontFamily: fonts.bold },
    heroActivityTitle: { color: colors.ink, fontSize: fontSizes.sm, letterSpacing: -0.2, fontFamily: fonts.bold },
    heroActivityDetail: { color: colors.inkMuted, fontSize: fontSizes.xs, lineHeight: 17, fontFamily: fonts.medium },

    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    sectionTitle: { color: colors.ink, fontSize: fontSizes.md, letterSpacing: -0.3, fontFamily: fonts.bold },
    sectionCount: { color: colors.inkFaint, fontSize: fontSizes.xs, fontFamily: fonts.medium },
    providerHeading: { marginTop: 4 },
    seeAll: { color: colors.active, fontSize: fontSizes.sm, fontFamily: fonts.bold, textDecorationLine: 'underline' },

    categoryRow: { gap: spacing.lg },

    filterEmpty: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.md,
      ...shadow.card,
    },
    filterEmptyText: { color: colors.inkMuted, fontSize: fontSizes.sm, fontFamily: fonts.medium },

    providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  });
}

/** Styles for TopProviderCard - a separate function (mirrors the pattern
 * elsewhere in this codebase, e.g. AllProvidersScreen's ProviderRow) so the
 * card component doesn't depend on HomeScreen's own makeStyles output. */
function makeCardStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    // No overflow:hidden here - the photo below is its own inset, rounded,
    // independently-shadowed frame rather than a full-bleed image clipped
    // to the card's edges, so both it and the card need room for their
    // shadows to actually render (an overflow:hidden ancestor clips shadows
    // too, on both platforms).
    card: {
      width: '48%',
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      padding: spacing.sm,
      gap: spacing.sm,
      ...shadow.card,
    },
    cardPressed: { opacity: 0.9 },
    photoFrame: {
      width: '100%',
      height: 132,
      borderRadius: radii.md,
      backgroundColor: colors.paperDim,
      shadowColor: colors.black,
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    cardBody: { gap: 6 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cardNameWrap: { flex: 1, gap: 1 },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardName: { flexShrink: 1, color: colors.ink, fontSize: fontSizes.sm, fontFamily: fonts.bold },
    cardTrade: { color: colors.inkMuted, fontSize: fontSizes.xs, fontFamily: fonts.medium },
    cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cardMeta: { color: colors.inkFaint, fontSize: fontSizes.xs, fontFamily: fonts.medium, marginRight: 3 },
    metaDot: { width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: colors.inkFainter },
  });
}
