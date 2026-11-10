import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, fontSizes, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

/** What a person sees instead of a blank screen when something unexpected
 * breaks. Their account and data are fine; trying again reloads the screen. */
function CrashScreen({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <RotateCcw size={30} strokeWidth={2} color={colors.ink} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.copy}>
          That was on our side, not yours. Your account and jobs are safe. Try again, and if it keeps happening,
          close the app and open it again.
        </Text>
      </View>
      <View style={styles.footer}>
        <Button title="Try again" variant="active" onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}

type Props = { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for crash reporting (none is installed yet); the console keeps it
    // visible while developing.
    this.props.onError?.(error, info);
    console.error('Unhandled screen error', error);
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (this.state.failed) return <CrashScreen onRetry={this.retry} />;
    return this.props.children;
  }
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.paper },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
    iconWrap: {
      width: 76,
      height: 76,
      borderRadius: radii.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    title: { fontSize: fontSizes.xxl, fontFamily: fonts.extrabold, color: colors.ink, textAlign: 'center', letterSpacing: -0.4 },
    copy: { fontSize: fontSizes.md, lineHeight: 23, fontFamily: fonts.regular, color: colors.inkMuted, textAlign: 'center' },
    footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  });
}
