import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useCategories, useTopProviders } from '../../api/marketplace';
import { Avatar } from '../../components/Avatar';
import { CategoryTile } from '../../components/CategoryTile';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, shadow } from '../../theme';

export function HomeScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: categories = [] } = useCategories();
  const { data: providers = [] } = useTopProviders();

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <Screen dark edges={['top']}>
      <View style={styles.header}>
        <View style={{ gap: 3 }}>
          <Text style={styles.greeting}>Good morning, {firstName}</Text>
          <Text style={styles.headline}>What needs fixing?</Text>
        </View>
        <View style={styles.search}>
          <Text style={styles.searchIcon}>⌕</Text>
          <Text style={styles.searchPlaceholder}>Search plumbers, electricians…</Text>
        </View>
      </View>

      <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={styles.body}>
        <View style={styles.grid}>
          {categories.map((c) => (
            <View key={c.id} style={styles.gridItem}>
              <CategoryTile abbr={c.abbr} name={c.name} onPress={() => navigation.navigate('NewRequest')} />
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top rated nearby</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>

        <View style={{ gap: 12 }}>
          {providers.map((p) => (
            <View key={p.id} style={styles.providerCard}>
              <Avatar initials={p.initials} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.providerName}>{p.full_name}</Text>
                <Text style={styles.providerMeta}>
                  {p.provider_category} · {p.provider_rating.toFixed(1)} ★ · {p.provider_distance_km} km
                </Text>
              </View>
              <Pressable style={styles.requestBtn} onPress={() => navigation.navigate('NewRequest')}>
                <Text style={styles.requestBtnLabel}>Request</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, gap: 16 },
  greeting: { color: colors.white, opacity: 0.8, fontSize: 13, fontFamily: fonts.medium },
  headline: { color: colors.white, fontSize: 22, fontFamily: fonts.extrabold },
  search: { height: 48, borderRadius: radii.lg, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchIcon: { fontSize: 15, color: colors.textFaint },
  searchPlaceholder: { fontSize: 15, color: colors.textFaint, fontFamily: fonts.medium },
  body: { padding: 16, paddingBottom: 100, gap: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '23%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
  seeAll: { fontSize: 13, fontFamily: fonts.bold, color: colors.orangeDeep },
  providerCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 14,
    borderRadius: radii.xxl,
    backgroundColor: colors.card,
    ...shadow.card,
  },
  providerName: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  providerMeta: { fontSize: 12, color: colors.textFaint },
  requestBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.ink },
  requestBtnLabel: { color: colors.white, fontSize: 13, fontFamily: fonts.bold },
});
