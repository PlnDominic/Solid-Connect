import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Switch, Text, View, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

const STORAGE_KEY = 'solid-connect:privacy-prefs';
const DEFAULT_PREFS = { shareUsageData: true };
type Prefs = typeof DEFAULT_PREFS;

export function PrivacyDataScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      })
      .catch(() => {});
  }, []);

  function toggle() {
    setPrefs((prev) => {
      const next = { ...prev, shareUsageData: !prev.shareUsageData };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function requestData() {
    const who = profile?.email || profile?.phone || profile?.id || '';
    const body = `Please send a copy of the data linked to my account (${who}).`;
    Linking.openURL(
      `mailto:support@solidconnect.app?subject=${encodeURIComponent('Data request')}&body=${encodeURIComponent(body)}`
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Privacy & data" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2, paddingRight: spacing.md }}>
              <Text style={styles.rowLabel}>Share usage data</Text>
              <Text style={styles.rowDetail}>Helps improve matching and fix problems faster</Text>
            </View>
            <Switch
              value={prefs.shareUsageData}
              onValueChange={toggle}
              trackColor={{ false: colors.hairline, true: colors.ink }}
              thumbColor={Platform.OS === 'android' ? colors.white : undefined}
            />
          </View>
        </View>

        <Pressable style={styles.linkRow} onPress={requestData}>
          <Text style={styles.linkLabel}>Request a copy of my data</Text>
          <ChevronRight size={16} strokeWidth={2} color={colors.inkFaint} />
        </Pressable>

        <Pressable style={styles.dangerRow} onPress={() => navigation.navigate('DeleteAccount')}>
          <Text style={styles.dangerLabel}>Delete account</Text>
          <ChevronRight size={16} strokeWidth={2} color={colors.danger} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, paddingHorizontal: spacing.lg },
  rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  rowDetail: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, marginTop: 2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  linkLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.lg,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dangerLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.danger },
});
