import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { LEGAL_DOCS, legalDocUrl } from '../lib/legal';
import { fonts, fontSizes, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

/** Opens a full legal document in the in-app browser (no-op while unpublished). */
export function openLegalDoc(slug: Parameters<typeof legalDocUrl>[0]) {
  const url = legalDocUrl(slug);
  if (url) void WebBrowser.openBrowserAsync(url).catch(() => {});
}

/**
 * Rows linking to the full published documents. Renders nothing until
 * EXPO_PUBLIC_LEGAL_URL is set (see legalDocUrl), so the unreviewed drafts
 * are never one tap away.
 */
export function LegalDocLinks() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  if (!legalDocUrl('terms')) return null;
  return (
    <View style={styles.list}>
      {LEGAL_DOCS.map((doc, i) => (
        <Pressable
          key={doc.slug}
          onPress={() => openLegalDoc(doc.slug)}
          style={({ pressed }) => [styles.row, i > 0 && styles.rule, pressed && styles.pressed]}
          accessibilityRole="link"
          accessibilityHint="Opens in your browser"
        >
          <Text style={styles.label}>{doc.title}</Text>
          <ChevronRight size={18} strokeWidth={2} color={colors.inkFaint} />
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    list: {},
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, minHeight: 44 },
    rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
    pressed: { opacity: 0.6 },
    label: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.ink },
  });
}
