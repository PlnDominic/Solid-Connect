import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { friendlyAuthError } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

export function AccountSecurityScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = password.length >= 8 && password === confirm && !saving;

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirm('');
      Alert.alert('Password updated', 'Use your new password the next time you sign in.');
    } catch (e) {
      setError(friendlyAuthError(e, 'Could not update your password. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Account security" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>Signed in as</Text>
            <Text style={styles.value}>{profile?.email ?? profile?.phone ?? 'Your account'}</Text>
          </View>

          <Text style={styles.section}>Change password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="New password (8+ characters)"
            placeholderTextColor={colors.inkFainter}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm new password"
            placeholderTextColor={colors.inkFainter}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Update password" onPress={handleSave} disabled={!canSave} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
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
      gap: 4,
      marginBottom: spacing.sm,
    },
    label: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.5 },
    value: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
    section: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink, marginTop: spacing.sm },
    input: {
      height: 52,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      fontSize: 15,
      fontFamily: fonts.regular,
      color: colors.ink,
    },
    error: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger },
  });
}
