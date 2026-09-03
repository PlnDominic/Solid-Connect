import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radii, spacing } from '../../theme';

const STORAGE_KEY = 'solid-connect:notification-prefs';

const DEFAULT_PREFS = {
  jobUpdates: true,
  newQuotes: true,
  messages: true,
  promotions: false,
};

type Prefs = typeof DEFAULT_PREFS;

const ROWS: { key: keyof Prefs; label: string; detail: string }[] = [
  { key: 'jobUpdates', label: 'Job updates', detail: 'Progress, completion and payment status' },
  { key: 'newQuotes', label: 'New quotes', detail: 'When a provider responds to your request' },
  { key: 'messages', label: 'Messages', detail: 'New chat messages from providers or customers' },
  { key: 'promotions', label: 'Promotions', detail: 'Offers and product updates from Solid Connect' },
];

export function NotificationsScreen({ navigation }: { navigation: any }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  function toggle(key: keyof Prefs) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <Screen>
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          {ROWS.map((row, i) => (
            <View key={row.key} style={[styles.row, i < ROWS.length - 1 && styles.rowBorder]}>
              <View style={{ flex: 1, gap: 2, paddingRight: spacing.md }}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowDetail}>{row.detail}</Text>
              </View>
              <Switch
                value={prefs[row.key]}
                onValueChange={() => toggle(row.key)}
                trackColor={{ false: colors.hairline, true: colors.ink }}
                thumbColor={Platform.OS === 'android' ? colors.white : undefined}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg },
  card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, paddingHorizontal: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  rowDetail: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, marginTop: 2 },
});
