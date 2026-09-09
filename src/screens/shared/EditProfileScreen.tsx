import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchProviderCategories } from '../../api/identity';
import { isEmailTaken, isPhoneTaken, updateOwnProfile } from '../../api/profile';
import { AreaPicker, isValidArea } from '../../components/AreaPicker';
import { Button } from '../../components/Button';
import { CategoryPicker } from '../../components/CategoryPicker';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { friendlyAuthError } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAGLINE_MAX = 140;

/**
 * Shared between customer and provider Profile stacks - fields it shows
 * differ (services only for providers), not the screen itself. Name/phone/
 * location/services save straight to the profiles row; email is the odd one
 * out (see updateOwnProfile's doc comment) - it goes through Supabase
 * auth's own confirmation flow instead, and doesn't touch profiles.email
 * until useSyncAuthEmail sees that confirmed.
 */
export function EditProfileScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profile = useSessionStore((s) => s.profile);
  const setProfile = useSessionStore((s) => s.setProfile);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [tagline, setTagline] = useState(profile?.tagline ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [area, setArea] = useState(profile?.area ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmailNotice, setPendingEmailNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== 'provider') {
      setCategoriesLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProviderCategories(profile.id);
        if (cancelled) return;
        const ids = rows.map((r) => r.category_id).filter(Boolean);
        if (ids.length) setCategoryIds(ids);
      } catch {
        // Fall back to empty selection; user can re-pick.
      } finally {
        if (!cancelled) setCategoriesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role]);

  if (!profile) return <Screen />;
  const p = profile;

  const isProvider = p.role === 'provider';
  const emailChanged = email.trim() !== (p.email ?? '');
  const isValid =
    fullName.trim().length >= 2 &&
    isValidArea(area) &&
    EMAIL_RE.test(email.trim()) &&
    (!isProvider || categoryIds.length > 0);

  async function handleSave() {
    setError(null);
    setPendingEmailNotice(null);
    setSaving(true);
    try {
      const trimmedPhone = phone.trim();
      if (trimmedPhone && trimmedPhone !== p.phone) {
        const taken = await isPhoneTaken(trimmedPhone, p.id).catch(() => false);
        if (taken) {
          setError('That phone number is already registered to another account.');
          return;
        }
      }

      if (emailChanged) {
        const trimmedEmail = email.trim();
        const taken = await isEmailTaken(trimmedEmail, p.id).catch(() => false);
        if (taken) {
          setError('An account with that email already exists.');
          return;
        }
        const { error: authError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (authError) throw authError;
        setPendingEmailNotice(
          `We sent a confirmation link to ${trimmedEmail}. Your email updates once you click it.`
        );
      }

      const updated = await updateOwnProfile(p.id, p.role, {
        fullName: fullName.trim(),
        phone: trimmedPhone,
        area,
        providerCategoryIds: isProvider ? categoryIds : undefined,
        tagline,
      });
      // Keep showing the old (still-current) email until the confirmation
      // link is actually clicked - updateOwnProfile never touches it.
      setProfile({ ...updated, email: p.email });
    } catch (e: any) {
      setError(friendlyAuthError(e, 'Could not save your changes. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Edit profile" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor={colors.inkFainter}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Tagline</Text>
              <Text style={styles.labelCount}>{tagline.length}/{TAGLINE_MAX}</Text>
            </View>
            <TextInput
              value={tagline}
              onChangeText={(t) => setTagline(t.slice(0, TAGLINE_MAX))}
              placeholder="A short line about you (optional)"
              placeholderTextColor={colors.inkFainter}
              multiline
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="024 123 4567"
              placeholderTextColor={colors.inkFainter}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={colors.inkFainter}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {pendingEmailNotice ? <Text style={styles.notice}>{pendingEmailNotice}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Location</Text>
            <AreaPicker value={area} onChangeValue={setArea} />
          </View>

          {isProvider && categoriesLoaded ? (
            <View style={styles.field}>
              <Text style={styles.label}>Services you offer</Text>
              <CategoryPicker multi values={categoryIds} onChangeValues={setCategoryIds} />
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Save changes" onPress={handleSave} disabled={!isValid || saving} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.xl },
  field: { gap: spacing.sm },
  label: { fontSize: 13, fontFamily: fonts.semibold, color: colors.inkFaint },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelCount: { fontSize: 11.5, fontFamily: fonts.medium, color: colors.inkFainter },
  input: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  notice: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.confirm, lineHeight: 18 },
  errorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
});
}
