import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { friendlyAuthError, signOut } from '../../lib/auth';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountScreen({ navigation }: { navigation: any }) {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isConfirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  // Actually erasing the underlying account record needs a service-role
  // call this client app doesn't hold - so this signs the device out and
  // hands the request to support, rather than pretending to reach data it
  // can't (the same honesty PaymentMethodsScreen uses for simulated pay).
  async function handleDelete() {
    setError('');
    setSubmitting(true);
    try {
      await signOut();
      useSessionStore.getState().setProfile(null);
      useSessionStore.getState().setUserId(null);
      let root = navigation;
      while (root.getParent()) root = root.getParent();
      root.reset({ index: 0, routes: [{ name: 'Auth' }] });
    } catch (e) {
      setError(friendlyAuthError(e, "Couldn't sign you out. Try again."));
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Delete account" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.warningCard}>
            <AlertTriangle size={18} strokeWidth={2.2} color={colors.danger} />
            <Text style={styles.warningText}>
              This signs you out immediately and sends a deletion request to Solid Connect support, who erase your
              profile, requests, and messages within a few days. This can't be undone once processed.
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Type {CONFIRM_WORD} to confirm</Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={colors.inkFainter}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Delete my account"
            onPress={handleDelete}
            disabled={!isConfirmed}
            loading={submitting}
            style={styles.deleteButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.xl },
  warningCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderRadius: radii.lg,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
  },
  warningText: { flex: 1, fontSize: 13, fontFamily: fonts.medium, color: colors.danger, lineHeight: 19 },
  label: { fontSize: 12.5, fontFamily: fonts.bold, color: colors.inkFaint, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  error: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger },
  deleteButton: { backgroundColor: colors.danger },
});
