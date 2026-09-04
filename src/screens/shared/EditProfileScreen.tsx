import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { FieldInput } from '../../components/FieldInput';
import { useUpdateOwnProfile } from '../../api/profile';
import { friendlyAuthError } from '../../lib/auth';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, spacing } from '../../theme';

export function EditProfileScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const update = useUpdateOwnProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [area, setArea] = useState(profile?.area ?? '');
  const [error, setError] = useState('');

  if (!profile) return <Screen />;

  const isValid = fullName.trim().length >= 2;

  async function handleSave() {
    setError('');
    try {
      await update.mutateAsync({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        area: area.trim(),
      });
      navigation.goBack();
    } catch (e) {
      setError(friendlyAuthError(e, "Couldn't save your profile. Try again."));
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Edit profile" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <FieldInput label="Full name" value={fullName} onChangeText={setFullName} placeholder="Full name" autoCapitalize="words" />
            <FieldInput label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
            <FieldInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FieldInput label="Area" value={area} onChangeText={setArea} placeholder="Neighborhood" autoCapitalize="words" />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Save changes" onPress={handleSave} loading={update.isPending} disabled={!isValid} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.lg },
  error: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger },
});
