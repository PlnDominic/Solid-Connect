import { Check } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LOCALE_LABELS, useLocale, type Locale } from '../../i18n';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const OPTIONS: Locale[] = ['en', 'tw', 'ga'];

export function LanguageScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { locale, setLocale, t } = useLocale();

  return (
    <Screen>
      <ScreenHeader title={t('settings.language')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>{t('settings.languageIntro')}</Text>
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            {OPTIONS.map((opt, i) => {
              const active = locale === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setLocale(opt)}
                  style={[styles.row, i < OPTIONS.length - 1 && styles.rowBorder]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.rowLabel}>{LOCALE_LABELS[opt]}</Text>
                  {active ? <Check size={18} strokeWidth={2.4} color={colors.ink} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
    cardShadow: { borderRadius: radii.lg, backgroundColor: colors.card, ...shadow.card },
    card: { borderRadius: radii.lg, overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
    rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  });
}
