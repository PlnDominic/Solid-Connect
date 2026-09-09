import { Heart, Star } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useSavedProviders, useToggleSavedProvider } from '../../api/saved';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';
import type { Profile } from '../../types/database';

function SavedProviderRow({
  provider,
  customerId,
  onOpen,
}: {
  provider: Profile;
  customerId: string;
  onOpen: () => void;
}) {
  const toggleSaved = useToggleSavedProvider();

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <Avatar initials={provider.initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name}>{provider.full_name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{provider.provider_category} ·</Text>
          <Star color={colors.ink} fill={colors.ink} size={10} strokeWidth={2} />
          <Text style={styles.meta}>{provider.provider_rating.toFixed(1)} · {provider.provider_distance_km} km</Text>
        </View>
      </View>
      <Pressable
        hitSlop={10}
        onPress={() => toggleSaved.mutate({ customerId, providerId: provider.id, saved: true })}
      >
        <Heart size={18} strokeWidth={2} color={colors.active} fill={colors.active} />
      </Pressable>
    </Pressable>
  );
}

export function SavedProvidersScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: saved = [], refetch } = useSavedProviders(profile?.id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  return (
    <Screen>
      <ScreenHeader title="Saved providers" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        }
      >
        {saved.length ? (
          saved.map((p) =>
            profile ? (
              <SavedProviderRow
                key={p.id}
                provider={p}
                customerId={profile.id}
                onOpen={() => navigation.navigate('ProviderDetail', { providerId: p.id })}
              />
            ) : null
          )
        ) : (
          <EmptyState title="No saved providers" subtitle="Tap the heart on a provider to save them here." />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
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
