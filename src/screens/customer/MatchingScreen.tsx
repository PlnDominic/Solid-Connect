import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useServiceRequest, useSimulateQuotesArriving } from '../../api/requests';
import { Screen } from '../../components/Screen';
import { colors, fonts, radii, spacing } from '../../theme';

export function MatchingScreen({ navigation, route }: { navigation: any; route: any }) {
  const requestId: string = route.params.requestId;
  const { data: request } = useServiceRequest(requestId);
  const simulate = useSimulateQuotesArriving();

  async function handleSimulate() {
    await simulate.mutateAsync(requestId);
    navigation.navigate('RequestsTab', { screen: 'RequestsHome' });
  }

  return (
    <Screen dark edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.navigate('HomeTab', { screen: 'Home' })} hitSlop={12}>
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Finding providers</Text>
        </View>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {request?.category_label} · {request?.location_label}
          </Text>
          <Text style={styles.summarySub}>
            Requested just now · Budget GHS {request?.budget_min}–{request?.budget_max}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.icon}>
          <Text style={{ color: colors.textFaint, fontSize: 20 }}>◎</Text>
        </View>
        <Text style={styles.title}>No quotes yet</Text>
        <Text style={styles.subtitle}>Providers nearby are reviewing your request. Most reply within 30 minutes.</Text>
        <Pressable onPress={handleSimulate} style={styles.simulateBtn} disabled={simulate.isPending}>
          <Text style={styles.simulateLabel}>
            {simulate.isPending ? 'Matching…' : 'Skip ahead: 3 quotes just came in'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chevron: { color: colors.white, fontSize: 20 },
  headerTitle: { color: colors.white, fontSize: 18, fontFamily: fonts.bold },
  summary: { padding: 14, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.12)', gap: 3 },
  summaryTitle: { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
  summarySub: { color: colors.white, opacity: 0.8, fontSize: 12 },
  body: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 40 },
  icon: { width: 44, height: 44, borderRadius: 999, backgroundColor: '#F4F6F8', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textFaint, lineHeight: 19, textAlign: 'center', maxWidth: 240 },
  simulateBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radii.md, backgroundColor: colors.tile },
  simulateLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.black },
});
