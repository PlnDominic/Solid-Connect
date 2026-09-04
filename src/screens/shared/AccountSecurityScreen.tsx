import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { FieldInput } from '../../components/FieldInput';
import { friendlyAuthError } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

export function AccountSecurityScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isValid = newPassword.length >= 8 && newPassword === confirmPassword;

  async function handleChangePassword() {
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (e) {
      setError(friendlyAuthError(e, "Couldn't update your password. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Account & security" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.sectionTitle}>Signed in as</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{profile?.email || 'Not set'}</Text>
              </View>
              <View style={styles.rowBorder} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Phone</Text>
                <Text style={styles.rowValue}>{profile?.phone || 'Not set'}</Text>
              </View>
            </View>
            <Text style={styles.hint}>To change your email or phone, use Edit profile.</Text>
          </View>

          <View style={{ gap: spacing.lg }}>
            <Text style={styles.sectionTitle}>Change password</Text>
            <FieldInput
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoCapitalize="none"
            />
            <FieldInput
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              secureTextEntry
              autoCapitalize="none"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>Password updated.</Text> : null}
            <Button title="Update password" onPress={handleChangePassword} loading={saving} disabled={!isValid} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.xl },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink, marginBottom: spacing.sm },
  card: { borderRadius: radii.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingHorizontal: spacing.lg },
  rowBorder: { height: 1, backgroundColor: colors.hairline },
  rowLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  rowValue: { fontSize: 13, fontFamily: fonts.medium, color: colors.inkFaint },
  hint: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.inkFaint, marginTop: spacing.sm, lineHeight: 18 },
  error: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger },
  success: { fontSize: 13, fontFamily: fonts.medium, color: colors.confirm },
});
