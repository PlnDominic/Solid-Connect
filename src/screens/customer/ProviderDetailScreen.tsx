import { useEffect, useState } from 'react';
import { Heart, MapPin, Star } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchProviderCategories, type ProviderCategoryRow } from '../../api/identity';
import { usePortfolioPhotos } from '../../api/portfolio';
import { useProvider } from '../../api/marketplace';
import { useProviderReviews } from '../../api/reviews';
import { useIsProviderSaved, useToggleSavedProvider } from '../../api/saved';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { ReviewCard } from '../../components/ReviewCard';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { isIdentityVerified, verificationLevelLabel } from '../../lib/verification';

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
        <ScreenHeader title="Provider" onBack={() => navigation.goBack()} />
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

  return (
    <Screen>
      <ScreenHeader title={provider.full_name} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {provider.photo_url ? (
            <Image source={{ uri: provider.photo_url }} style={styles.heroPhoto} />
          ) : (
            <Avatar initials={provider.initials} size={88} />
          )}
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.name}>{provider.full_name}</Text>
            {provider.tagline ? <Text style={styles.tagline}>{provider.tagline}</Text> : null}
            <Text style={styles.meta}>{servicesLabel}</Text>
            <View style={styles.metaRow}>
              <Star color={colors.ink} fill={colors.ink} size={12} strokeWidth={2} />
              <Text style={styles.metaStrong}>{provider.provider_rating.toFixed(1)}</Text>
              <Text style={styles.meta}>· {provider.provider_jobs_count} jobs</Text>
            </View>
            <View style={styles.metaRow}>
              <MapPin size={12} strokeWidth={2} color={colors.inkFaint} />
              <Text style={styles.meta}>{provider.area}</Text>
              {provider.provider_distance_km != null ? (
                <Text style={styles.meta}>· {provider.provider_distance_km} km</Text>
              ) : null}
            </View>
            {badgeKind === 'certified' ? (
              <Badge label="Solid Connect verified" bg={colors.confirmBg} fg={colors.confirmDeep} />
            ) : badgeKind === 'verified' ? (
              <Badge label={trustLabel} bg={colors.navyBg} fg={colors.navy} />
            ) : null}
          </View>
          {profile ? (
            <Pressable
              hitSlop={10}
              onPress={() =>
                toggleSaved.mutate({ customerId: profile.id, providerId: provider.id, saved })
              }
            >
              <Heart
                size={22}
                strokeWidth={2}
                color={saved ? colors.active : colors.inkFaint}
                fill={saved ? colors.active : 'transparent'}
              />
            </Pressable>
          ) : null}
        </View>

        {serviceNames.length > 1 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Request a service</Text>
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
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio</Text>
          {portfolio.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioRow}>
              {portfolio.map((p) => (
                <Image key={p.id} source={{ uri: p.photo_url }} style={styles.portfolioThumb} />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyHint}>No portfolio photos yet.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          {reviews.length ? (
            reviews.slice(0, 8).map((r) => <ReviewCard key={r.id} review={r} />)
          ) : (
            <EmptyState title="No reviews yet" subtitle="Completed jobs will show ratings here." />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
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
        >
          <Text style={styles.ctaLabel}>
            Request {requestTrade ?? 'this trade'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
    hero: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    heroPhoto: { width: 88, height: 88, borderRadius: radii.lg, backgroundColor: colors.paperDim },
    name: { fontSize: 18, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.3 },
    tagline: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 18 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
    meta: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
    metaStrong: { fontSize: 12.5, fontFamily: fonts.bold, color: colors.ink, fontVariant: ['tabular-nums'] },
    section: { gap: spacing.sm },
    sectionTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.active, borderColor: colors.active },
    chipLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
    chipLabelActive: { color: colors.white },
    portfolioRow: { gap: spacing.sm },
    portfolioThumb: { width: 96, height: 96, borderRadius: radii.md, backgroundColor: colors.paperDim },
    emptyHint: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
    footer: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      backgroundColor: colors.card,
    },
    cta: {
      height: 52,
      borderRadius: radii.lg,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaLabel: { fontSize: 15, fontFamily: fonts.bold, color: colors.paper },
  });
}
