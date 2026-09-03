import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useFeedRequests } from '../../api/requests';
import { Badge } from '../../components/Badge';
import { Screen } from '../../components/Screen';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, shadow } from '../../theme';

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
}

export function FeedScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: requests = [] } = useFeedRequests(profile?.id ?? null);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{profile?.area} · within 5 km</Text>
        <Text style={styles.title}>Nearby requests</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {requests.map((r) => (
          <Pressable key={r.id} style={styles.card} onPress={() => navigation.navigate('RequestDetail', { requestId: r.id })}>
            <View style={styles.cardTop}>
              <View style={{ gap: 3 }}>
                <Text style={styles.cardTitle}>{r.category_label.split('·').pop()?.trim()}</Text>
                <Text style={styles.cardMeta}>
                  {r.location_label} · {timeAgo(r.created_at)}
                </Text>
              </View>
              <Text style={styles.cardBudget}>
                GHS {r.budget_min}–{r.budget_max}
              </Text>
            </View>
            {r.myQuote ? (
              <Badge label="✓ Quote sent" bg={colors.successBg} fg={colors.successFg} />
            ) : (
              <Badge label={r.category_label.split('·')[0]?.trim() ?? ''} bg={colors.hairlineSoft} fg={colors.textMuted} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 24, gap: 5, backgroundColor: '#101722' },
  eyebrow: { fontSize: 12, color: 'rgba(255,255,255,0.58)', fontFamily: fonts.medium },
  title: { fontSize: 28, letterSpacing: -0.9, fontFamily: fonts.extrabold, color: colors.white },
  body: { padding: 16, paddingTop: 20, gap: 12 },
  card: { borderRadius: 20, backgroundColor: colors.card, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, ...shadow.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.textFaint },
  cardBudget: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.ink, fontVariant: ['tabular-nums'] },
});
