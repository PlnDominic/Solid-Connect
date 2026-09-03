import { Heart, Star } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useAllProviders } from '../../api/marketplace';
import { useIsProviderSaved, useToggleSavedProvider } from '../../api/saved';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';
import type { Profile } from '../../types/database';

function ProviderRow({ provider, customerId }: { provider: Profile; customerId: string }) {
  const { data: saved = false } = useIsProviderSaved(customerId, provider.id);
  const toggleSaved = useToggleSavedProvider();

  return (
    <View style={styles.card}>
      <Avatar initials={provider.initials} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name}>{provider.full_name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{provider.provider_category} ·</Text>
          <Star color={colors.ink} fill={colors.ink} size={10} strokeWidth={2} />
          <Text style={styles.meta}>{provider.provider_rating.toFixed(1)} · {provider.provider_distance_km} km</Text>
        </View>
      </View>
      <Pressable hitSlop={10} onPress={() => toggleSaved.mutate({ customerId, providerId: provider.id, saved })}>
        <Heart
          size={18}
          strokeWidth={2}
          color={saved ? colors.active : colors.inkFaint}
          fill={saved ? colors.active : 'transparent'}
        />
      </Pressable>
    </View>
  );
}

export function AllProvidersScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: providers = [] } = useAllProviders();

  return (
    <Screen>
      <ScreenHeader title="All providers" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {providers.length ? (
          providers.map((p) => (profile ? <ProviderRow key={p.id} provider={p} customerId={profile.id} /> : null))
        ) : (
          <EmptyState title="No providers yet" subtitle="Check back soon - new providers are joining Solid Connect." />
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
