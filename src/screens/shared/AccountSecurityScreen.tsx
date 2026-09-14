import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  useAccountDeletionRequest,
  useCancelAccountDeletionRequest,
  useRequestAccountDeletion,
} from '../../api/profile';
import { authenticateWithBiometrics, useBiometricLockPreference } from '../../hooks/useBiometricLock';
import { friendlyAuthError } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

function stamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AccountSecurityScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: deletionRequest } = useAccountDeletionRequest(profile?.id ?? null);
  const requestDeletion = useRequestAccountDeletion();
  const cancelDeletion = useCancelAccountDeletionRequest();
  const [deleteReason, setDeleteReason] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isPending = deletionRequest?.status === 'pending';

  const biometrics = useBiometricLockPreference();
  const [biometricBusy, setBiometricBusy] = useState(false);

  async function handleToggleBiometrics(value: boolean) {
    if (!value) {
      await biometrics.setEnabled(false);
      return;
    }
    // Confirm the sensor actually works before committing to locking the
    // app behind it - turning this on blind could lock someone out.
    setBiometricBusy(true);
    const ok = await authenticateWithBiometrics('Confirm to enable app lock');
    setBiometricBusy(false);
    if (ok) {
      await biometrics.setEnabled(true);
    } else {
      Alert.alert('Could not confirm', 'Verify with Face ID / Touch ID / fingerprint to turn this on.');
    }
  }

  function handleRequestDeletion() {
    if (!profile) return;
    Alert.alert(
      'Delete your account?',
      "This sends a deletion request to Solid Connect's team. Your profile, verification documents, and contact details will be removed once it's processed; job and payment history tied to other people's accounts is kept in an anonymized form, same as removing a review only recalculates the total rather than erasing it. This can take a few days.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request deletion',
          style: 'destructive',
          onPress: () => {
            requestDeletion.mutate(
              { userId: profile.id, reason: deleteReason },
              {
                onSuccess: () => setConfirmingDelete(false),
                onError: (e: any) =>
                  Alert.alert('Could not submit request', friendlyAuthError(e, 'Please try again.')),
              },
            );
          },
        },
      ],
    );
  }

  function handleCancelDeletion() {
    if (!profile || !deletionRequest) return;
    cancelDeletion.mutate({ id: deletionRequest.id, userId: profile.id });
  }

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

          {biometrics.available ? (
            <>
              <Text style={styles.section}>App lock</Text>
              <View style={styles.card}>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, gap: 2, paddingRight: spacing.md }}>
                    <Text style={styles.value}>Require Face ID / Touch ID</Text>
                    <Text style={styles.rowDetail}>Lock Solid Connect when it's reopened.</Text>
                  </View>
                  <Switch
                    value={biometrics.enabled}
                    onValueChange={handleToggleBiometrics}
                    disabled={biometricBusy || !biometrics.loaded}
                    trackColor={{ false: colors.hairline, true: colors.ink }}
                    thumbColor={Platform.OS === 'android' ? colors.white : undefined}
                  />
                </View>
              </View>
            </>
          ) : null}

          <Text style={[styles.section, styles.dangerSection]}>Danger zone</Text>
          {isPending ? (
            <View style={styles.card}>
              <Text style={styles.label}>Deletion requested</Text>
              <Text style={styles.value}>
                Submitted {stamp(deletionRequest!.requested_at)} - Solid Connect's team will process this soon.
              </Text>
              <Button
                title="Cancel request"
                variant="outline"
                onPress={handleCancelDeletion}
                loading={cancelDeletion.isPending}
              />
            </View>
          ) : confirmingDelete ? (
            <View style={styles.card}>
              <Text style={styles.label}>Why are you leaving? (optional)</Text>
              <TextInput
                value={deleteReason}
                onChangeText={setDeleteReason}
                placeholder="Optional - helps us improve"
                placeholderTextColor={colors.inkFainter}
                multiline
                style={[styles.input, styles.reasonInput]}
              />
              <Button
                title="Request account deletion"
                variant="outline"
                onPress={handleRequestDeletion}
                loading={requestDeletion.isPending}
              />
              <Button title="Never mind" variant="outline" onPress={() => setConfirmingDelete(false)} />
            </View>
          ) : (
            <Button title="Delete my account" variant="outline" onPress={() => setConfirmingDelete(true)} />
          )}
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
    toggleRow: { flexDirection: 'row', alignItems: 'center' },
    rowDetail: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
    section: { fontSize: 13, fontFamily: fonts.bold, color: colors.ink, marginTop: spacing.sm },
    dangerSection: { color: colors.danger, marginTop: spacing.xl },
    reasonInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: spacing.md },
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
