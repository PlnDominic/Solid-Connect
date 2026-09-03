import { useState } from 'react';
import { ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useSendQuote, useServiceRequest } from '../../api/requests';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
}

export function RequestDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const requestId: string = route.params.requestId;
  const profile = useSessionStore((s) => s.profile);
  const { data: request } = useServiceRequest(requestId);
  const sendQuote = useSendQuote();
  const [price, setPrice] = useState('');

  if (!request) return <Screen />;

  const title = request.category_label.split('·').pop()?.trim() ?? request.category_label;

  async function handleSend() {
    if (!profile || !request) return;
    const numeric = parseInt(price, 10);
    if (!numeric || numeric <= 0) return;
    await sendQuote.mutateAsync({
      requestId: request.id,
      providerId: profile.id,
      price: numeric,
      etaLabel: 'Today, 2 hrs',
      badgeLabel: profile.provider_certified ? 'Certified' : 'Identity verified',
      badgeKind: profile.provider_certified ? 'certified' : 'verified',
    });
    navigation.navigate('Feed');
  }

  return (
    <Screen>
      <ScreenHeader title={title} onBack={() => navigation.navigate('Feed')} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {request.location_label} · {timeAgo(request.created_at)}
          </Text>
          <Text style={styles.summarySub}>
            Budget GHS {request.budget_min}-{request.budget_max}
          </Text>
        </View>
        <Text style={styles.desc}>{request.description}</Text>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>Your price</Text>
          <View style={styles.priceField}>
            <Text style={styles.priceCurrency}>GHS</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              placeholder="480"
              placeholderTextColor={colors.inkFaint}
              keyboardType="number-pad"
              style={styles.priceInput}
            />
          </View>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>You can start</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyValue}>Today, 2 hrs</Text>
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Send quote" onPress={handleSend} loading={sendQuote.isPending} disabled={!price} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl },
  summary: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.card, padding: spacing.md, gap: 3 },
  summaryTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  summarySub: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkMuted },
  desc: { fontSize: 14, lineHeight: 22, fontFamily: fonts.regular, color: colors.inkMuted },
  fieldLabel: { fontSize: 12.5, fontFamily: fonts.semibold, color: colors.inkFaint, letterSpacing: 0.2 },
  priceField: {
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  priceCurrency: { color: colors.inkFaint, marginRight: 6, fontSize: 16, fontFamily: fonts.medium },
  priceInput: { flex: 1, fontSize: 16, fontFamily: fonts.medium, color: colors.ink },
  readonlyField: {
    height: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  readonlyValue: { fontSize: 15, fontFamily: fonts.medium, color: colors.ink },
  footer: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.hairline },
});
