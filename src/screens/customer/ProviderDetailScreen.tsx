import { useEffect, useState } from 'react';
import { ArrowLeft, Heart, MapPin, MessageCircle, Play, Share2, Star } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, Alert, Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { fetchProviderCategories, type ProviderCategoryRow } from '../../api/identity';
import { getOrCreateThread } from '../../api/chat';
import { usePortfolioPhotos } from '../../api/portfolio';
import { useProvider } from '../../api/marketplace';
import { useProviderReviews } from '../../api/reviews';
import { useIsProviderSaved, useToggleSavedProvider } from '../../api/saved';
import { recordProviderView } from '../../hooks/useRecentlyViewedProviders';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ImageViewer, useImageViewer } from '../../components/ImageViewer';
import { ReviewCard } from '../../components/ReviewCard';
import { Screen } from '../../components/Screen';
import { VideoPlayerModal } from '../../components/VideoPlayerModal';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { isIdentityVerified, verificationLevelLabel } from '../../lib/verification';

// Thumbnail strip shows at most this many real photos before collapsing
// the rest into one "+N" tile - matches the reference's 4-thumbs-plus-tile
// layout rather than an ever-growing row.
const VISIBLE_THUMBS = 4;
// Below this length the bio reads fine in 3 lines with nothing hidden -
// no "Read more" toggle offering to reveal text that isn't actually cut.
const BIO_TRUNCATE_AT = 120;

export function ProviderDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const providerId: string = route.params.providerId;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: provider, isLoading } = useProvider(providerId);
  const { data: portfolio = [] } = usePortfolioPhotos(providerId);
  const { data: reviews = [] } = useProviderReviews(providerId);
  const { data: saved = false } = useIsProviderSaved(profile?.id ?? null, providerId);
  const toggleSaved = useToggleSavedProvider();
  const [serviceRows, setServiceRows] = useState<ProviderCategoryRow[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [messaging, setMessaging] = useState(false);
  // Which photo the big hero frame shows - starts on the provider's own
  // photo, but tapping a portfolio thumbnail swaps it in, same as an
  // e-commerce product page's thumbnail strip.
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const imageViewer = useImageViewer();
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const portfolioPhotoUrls = portfolio.filter((p) => p.media_type !== 'video').map((p) => p.photo_url);

  useEffect(() => {
    recordProviderView(providerId);
  }, [providerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProviderCategories(providerId);
        if (cancelled) return;
        setServiceRows(rows);
        const primary = rows.find((r) => r.is_primary)?.categories?.name
          ?? rows[0]?.categories?.name
          ?? null;
        setSelectedService(primary);
      } catch {
        if (!cancelled) setServiceRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  if (isLoading || !provider) {
    return (
      <Screen>
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
            <ArrowLeft size={19} strokeWidth={2.2} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Provider Details</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </Screen>
    );
  }

  const serviceNames = serviceRows
    .map((r) => r.categories?.name)
    .filter((n): n is string => !!n);
  const servicesLabel =
    serviceNames.length > 0
      ? serviceNames.join(' · ')
      : provider.provider_category;
  const requestTrade =
    selectedService
    ?? serviceNames[0]
    ?? provider.provider_category
    ?? null;

  const badgeKind = provider.provider_certified
    ? 'certified'
    : isIdentityVerified(provider)
      ? 'verified'
      : null;
  const trustLabel =
    provider.provider_certified || provider.verification_level === 'SOLID_CONNECT_VERIFIED'
      ? 'Solid Connect verified'
      : verificationLevelLabel(provider);

  const bio = provider.tagline?.trim() || "This provider hasn't added a bio yet.";
  const bioTruncatable = bio.length > BIO_TRUNCATE_AT;

  const visibleThumbs = portfolio.slice(0, VISIBLE_THUMBS);
  const extraThumbCount = Math.max(0, portfolio.length - VISIBLE_THUMBS);
  const heroPhotoUrl = selectedPhoto ?? provider.photo_url ?? portfolioPhotoUrls[0] ?? null;
  // The full set the hero's own tap-to-zoom viewer can page through -
  // the provider's own photo first (if any), then their portfolio, with
  // no duplicate when the two happen to be the same photo.
  const heroGalleryUrls = provider.photo_url
    ? [provider.photo_url, ...portfolioPhotoUrls.filter((u) => u !== provider.photo_url)]
    : portfolioPhotoUrls;

  function handleThumbPress(index: number, isMoreTile: boolean) {
    const photo = portfolio[index];
    if (!photo) return;
    if (isMoreTile) {
      // "+N" - browse the rest in the full viewer rather than only
      // swapping the hero to this one photo.
      imageViewer.open(portfolioPhotoUrls, portfolioPhotoUrls.indexOf(photo.photo_url));
      return;
    }
    if (photo.media_type === 'video') {
      setPreviewVideoUrl(photo.photo_url);
    } else {
      setSelectedPhoto(photo.photo_url);
    }
  }

  function openHeroViewer() {
    if (!heroPhotoUrl) return;
    const index = heroGalleryUrls.indexOf(heroPhotoUrl);
    imageViewer.open(heroGalleryUrls, index === -1 ? 0 : index);
  }

  async function handleMessage() {
    // TS can't carry the early-return's `provider` narrowing into a nested
    // function closure even though it's a const - re-guard rather than
    // assert non-null.
    if (!profile || !provider) return;
    setMessaging(true);
    try {
      const thread = await getOrCreateThread({ customerId: profile.id, providerId: provider.id, asRole: 'customer' });
      navigation.navigate('ChatTab', { screen: 'ChatThread', params: { threadId: thread.id, peerId: provider.id } });
    } catch {
      Alert.alert("Couldn't open chat", 'Please try again.');
    } finally {
      setMessaging(false);
    }
  }

  async function handleShare() {
    if (!provider) return;
    try {
      await Share.share({
        message: `Check out ${provider.full_name} on Solid Connect - ${servicesLabel}.`,
        url: Linking.createURL(`/providers/${provider.id}`),
      });
    } catch {
      // best-effort
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={19} strokeWidth={2.2} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Provider Details</Text>
        {profile ? (
          <Pressable
            style={styles.iconBtn}
            onPress={() => toggleSaved.mutate({ customerId: profile.id, providerId: provider.id, saved })}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved providers' : 'Save this provider'}
            accessibilityState={{ selected: saved }}
          >
            <Heart size={18} strokeWidth={2.2} color={saved ? colors.ink : colors.inkFaint} fill={saved ? colors.ink : 'transparent'} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.heroCard}
          onPress={openHeroViewer}
          disabled={!heroPhotoUrl}
          accessibilityRole="imagebutton"
          accessibilityLabel="View full-size photo"
        >
          {heroPhotoUrl ? (
            <Image source={{ uri: heroPhotoUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Avatar initials={provider.initials} size={96} />
            </View>
          )}
        </Pressable>

        {visibleThumbs.length > 0 ? (
          <View style={styles.thumbRow}>
            {visibleThumbs.map((photo, index) => {
              const isLastVisible = index === VISIBLE_THUMBS - 1;
              const showMoreOverlay = isLastVisible && extraThumbCount > 0;
              const isSelected = !showMoreOverlay && photo.photo_url === heroPhotoUrl;
              return (
                <Pressable
                  key={photo.id}
                  style={[styles.thumb, isSelected && styles.thumbSelected]}
                  onPress={() => handleThumbPress(index, showMoreOverlay)}
                  accessibilityRole="button"
                  accessibilityLabel={showMoreOverlay ? `View ${extraThumbCount} more photos` : 'Show this photo'}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Image source={{ uri: photo.photo_url }} style={styles.thumbImage} />
                  {photo.media_type === 'video' && !showMoreOverlay ? (
                    <View style={styles.thumbPlayBadge} pointerEvents="none">
                      <Play size={13} strokeWidth={2.4} color={colors.white} fill={colors.white} />
                    </View>
                  ) : null}
                  {showMoreOverlay ? (
                    <View style={styles.thumbMoreOverlay} pointerEvents="none">
                      <Text style={styles.thumbMoreText}>+{extraThumbCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.categoryLabel} numberOfLines={1}>{servicesLabel}</Text>
          <View style={styles.ratingPill}>
            <Star color={colors.ink} fill={colors.ink} size={13} strokeWidth={2} />
            <Text style={styles.ratingText}>{provider.provider_rating.toFixed(1)}</Text>
          </View>
        </View>

        <Text style={styles.name} numberOfLines={2}>{provider.full_name}</Text>

        <View style={styles.locationRow}>
          <MapPin size={12} strokeWidth={2} color={colors.inkFaint} />
          <Text style={styles.locationText}>{provider.area}</Text>
          {provider.provider_distance_km != null ? (
            <Text style={styles.locationText}>· {provider.provider_distance_km} km · {provider.provider_jobs_count} jobs</Text>
          ) : (
            <Text style={styles.locationText}>· {provider.provider_jobs_count} jobs</Text>
          )}
        </View>

        {badgeKind === 'certified' ? (
          <Badge label="Solid Connect verified" bg={colors.confirmBg} fg={colors.confirmDeep} />
        ) : badgeKind === 'verified' ? (
          <Badge label={trustLabel} bg={colors.navyBg} fg={colors.navy} />
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.eyebrow}>PROVIDER</Text>
        <View style={styles.providerRow}>
          {provider.photo_url ? (
            <Image source={{ uri: provider.photo_url }} style={styles.providerAvatarImage} />
          ) : (
            <Avatar initials={provider.initials} size={44} />
          )}
          <View style={styles.providerInfo}>
            <Text style={styles.providerName} numberOfLines={1}>{provider.full_name}</Text>
            <Text style={styles.providerRole} numberOfLines={1}>{servicesLabel}</Text>
          </View>
          <Pressable
            style={[styles.actionIconBtn, styles.actionIconBtnPrimary]}
            onPress={handleMessage}
            disabled={messaging || !profile}
            accessibilityRole="button"
            accessibilityLabel={`Message ${provider.full_name}`}
          >
            <MessageCircle size={17} strokeWidth={2.2} color={colors.white} />
          </Pressable>
          <Pressable
            style={styles.actionIconBtn}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={`Share ${provider.full_name}'s profile`}
          >
            <Share2 size={16} strokeWidth={2.2} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.eyebrow}>ABOUT</Text>
        <Text style={styles.bioText} numberOfLines={bioExpanded ? undefined : 3}>
          {bio}
          {!bioExpanded && bioTruncatable ? (
            <Text style={styles.readMore} onPress={() => setBioExpanded(true)}> Read more</Text>
          ) : null}
        </Text>
        {bioExpanded && bioTruncatable ? (
          <Pressable onPress={() => setBioExpanded(false)}>
            <Text style={styles.readMore}>Show less</Text>
          </Pressable>
        ) : null}

        {serviceNames.length > 1 ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.eyebrow}>SELECT A SERVICE</Text>
            <View style={styles.chipsWrap}>
              {serviceNames.map((name) => {
                const active = selectedService === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setSelectedService(name)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.eyebrow}>REVIEWS</Text>
        {reviews.length ? (
          reviews.slice(0, 8).map((r) => <ReviewCard key={r.id} review={r} />)
        ) : (
          <EmptyState title="No reviews yet" subtitle="Completed jobs will show ratings here." />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerLabel}>Rating</Text>
          <View style={styles.footerRatingRow}>
            <Star color={colors.ink} fill={colors.ink} size={13} strokeWidth={2} />
            <Text style={styles.footerValue}>{provider.provider_rating.toFixed(1)} · {provider.provider_jobs_count} jobs</Text>
          </View>
        </View>
        <Button
          title={`Request ${requestTrade ?? 'service'}`}
          variant="active"
          style={styles.footerCta}
          onPress={() =>
            navigation.navigate('NewRequest', {
              initialCategoryName: requestTrade ?? undefined,
              preferredProviderId: provider.id,
              preferredProviderName: provider.full_name,
              initialDescription: `Looking for help from ${provider.full_name}${
                requestTrade ? ` (${requestTrade})` : ''
              }.`,
            })
          }
        />
      </View>

      <ImageViewer
        visible={imageViewer.visible}
        images={imageViewer.images}
        initialIndex={imageViewer.index}
        onClose={imageViewer.close}
      />
      <VideoPlayerModal
        visible={!!previewVideoUrl}
        uri={previewVideoUrl}
        onClose={() => setPreviewVideoUrl(null)}
      />
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.card,
    },
    scroll: { flex: 1 },
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },

    heroCard: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.paperDim,
      overflow: 'hidden',
      height: 280,
    },
    heroImage: { width: '100%', height: '100%' },
    heroFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    thumbRow: { flexDirection: 'row', gap: spacing.sm },
    thumb: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: radii.md,
      overflow: 'hidden',
      backgroundColor: colors.paperDim,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    thumbSelected: { borderColor: colors.active },
    thumbImage: { width: '100%', height: '100%' },
    thumbPlayBadge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    thumbMoreOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21,24,26,0.72)',
    },
    thumbMoreText: { color: colors.paper, fontSize: 16, fontFamily: fonts.extrabold },

    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
    categoryLabel: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
    ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink, fontVariant: ['tabular-nums'] },

    name: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.4 },

    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
    locationText: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },

    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },

    eyebrow: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6, marginBottom: -2 },

    providerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    providerAvatarImage: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.paperDim },
    providerInfo: { flex: 1, gap: 1 },
    providerName: { fontSize: 15.5, fontFamily: fonts.bold, color: colors.ink },
    providerRole: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
    actionIconBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    actionIconBtnPrimary: { backgroundColor: colors.ink, borderColor: colors.ink },

    bioText: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
    readMore: { fontSize: 14, fontFamily: fonts.bold, color: colors.active, textDecorationLine: 'underline' },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipLabel: { fontSize: 14.5, fontFamily: fonts.semibold, color: colors.ink },
    chipLabelActive: { color: colors.paper },

    // A normal flex sibling below the ScrollView (not absolutely
    // positioned) - Screen's SafeAreaView sizes around it naturally, same
    // pattern as NewRequestScreen's own bottom bar, so it never needs to
    // guess at the home-indicator inset itself.
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      backgroundColor: colors.paper,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
    },
    footerInfo: { gap: 2 },
    footerLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    footerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerValue: { fontSize: 14.5, fontFamily: fonts.bold, color: colors.ink },
    footerCta: { flex: 1 },
  });
}
