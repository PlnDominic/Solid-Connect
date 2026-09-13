import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LEGAL_SECTIONS } from '../../lib/legal';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function LegalScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Screen>
      <ScreenHeader title="Terms & privacy" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {LEGAL_SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.bodyText}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md },
    card: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    title: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    bodyText: { fontSize: 13.5, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
  });
}
