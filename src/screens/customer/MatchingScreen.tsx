import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import { useServiceRequest, useSimulateQuotesArriving } from '../../api/requests';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
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
    <Screen edges={['top']}>
      <ScreenHeader title="Finding providers" onBack={() => navigation.navigate('HomeTab', { screen: 'Home' })} />

      <View style={styles.summaryWrap}>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {request?.category_label} · {request?.location_label}
          </Text>
          <Text style={styles.summarySub}>
            Requested just now · Budget GHS {request?.budget_min}-{request?.budget_max}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.icon}>
          <Search size={20} strokeWidth={1.8} color={colors.inkFaint} />
        </View>
        <Text style={styles.title}>No quotes yet</Text>
        <Text style={styles.subtitle}>Providers nearby are reviewing your request. Most reply within 30 minutes.</Text>

        <Pressable
          onPress={handleSimulate}
          disabled={simulate.isPending}
          style={({ pressed }) => [styles.simulateBtn, pressed && !simulate.isPending && styles.simulateBtnPressed]}
        >
          <Text style={styles.simulateLabel}>
            {simulate.isPending ? 'Matching...' : 'Skip ahead: 3 quotes just came in'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  summary: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    gap: 3,
  },
  summaryTitle: { color: colors.ink, fontSize: 14, fontFamily: fonts.bold },
  summarySub: { color: colors.inkMuted, fontSize: 12, fontFamily: fonts.medium },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing.xxl, paddingVertical: 40 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.paperDim,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 15.5, fontFamily: fonts.bold, color: colors.ink },
  subtitle: { fontSize: 13, color: colors.inkMuted, lineHeight: 19, textAlign: 'center', maxWidth: 240, fontFamily: fonts.regular },

  simulateBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: colors.paperDim,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  simulateBtnPressed: { backgroundColor: colors.hairlineStrong },
  simulateLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink },
});
