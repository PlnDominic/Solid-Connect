import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useSendQuote, useServiceRequest } from '../../api/requests';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii } from '../../theme';

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
      badgeLabel: profile.provider_certified ? '★ Certified' : '✓ Identity verified',
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
            Budget GHS {request.budget_min}–{request.budget_max}
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
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              style={styles.priceInput}
            />
          </View>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={styles.fieldLabel}>You can start</Text>
          <View style={styles.readonlyField}>
            <Text style={{ fontSize: 15, color: colors.ink }}>Today, 2 hrs</Text>
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
  body: { padding: 16, gap: 16 },
  summary: { borderRadius: radii.xl, backgroundColor: colors.tile, padding: 14, gap: 6 },
  summaryTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  summarySub: { fontSize: 13, color: colors.textMuted },
  desc: { fontSize: 14, lineHeight: 22, color: colors.textBody },
  fieldLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
  priceField: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  priceCurrency: { color: colors.textFaint, marginRight: 6, fontSize: 16 },
  priceInput: { flex: 1, fontSize: 16, color: colors.ink },
  readonlyField: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  footer: { padding: 16, paddingBottom: 24, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.hairline },
});
