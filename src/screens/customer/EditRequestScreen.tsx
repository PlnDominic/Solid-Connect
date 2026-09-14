import { useEffect, useState } from 'react';
import { Camera, Plus, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useServiceRequest, useUpdateRequest } from '../../api/requests';
import { Button } from '../../components/Button';
import { LocationField } from '../../components/LocationField';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { isValidArea } from '../../components/AreaPicker';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

const MAX_PHOTOS = 4;

/**
 * Editing, not re-posting: description, budget, location, and photos only
 * - category is deliberately not offered here (changing trade is a new
 * request, not an edit of this one), and the server rejects the whole
 * call once the request has moved past 'open'/'matching' anyway (see
 * update_request() in 0034_update_request.sql).
 *
 * Same grouped-card/budget-field/photo-grid vocabulary as
 * NewRequestScreen's own step 2 - this is the same data, just reached
 * from the other direction, so it should look like the same form.
 */
export function EditRequestScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { requestId } = route.params;
  const profile = useSessionStore((s) => s.profile);
  const { data: request, isLoading } = useServiceRequest(requestId);
  const updateRequest = useUpdateRequest();

  const [description, setDescription] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const [budgetFocused, setBudgetFocused] = useState(false);
  const [location, setLocation] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    setDescription(request.description ?? '');
    setBudgetText(String(request.customer_budget ?? request.budget_min ?? ''));
    setLocation(request.location_label?.split(',')[0]?.trim() ?? '');
    setExistingPhotos(request.photos ?? []);
  }, [request]);

  const totalPhotos = existingPhotos.length + newPhotoUris.length;
  const budget = Number(budgetText);
  const isValid = description.trim().length > 0 && Number.isFinite(budget) && budget > 0 && isValidArea(location);

  async function pickPhoto() {
    if (totalPhotos >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    setNewPhotoUris((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS - existingPhotos.length));
  }

  async function handleSave() {
    if (!profile || !request || !isValid) return;
    setError(null);
    try {
      await updateRequest.mutateAsync({
        requestId: request.id,
        customerId: profile.id,
        description: description.trim(),
        budget: Math.round(budget),
        locationLabel: location.includes('Accra') ? location : `${location}, Accra`,
        existingPhotoUrls: existingPhotos,
        newPhotoUris,
      });
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message === 'REQUEST_NOT_EDITABLE'
        ? 'This request can no longer be edited - a provider has already responded.'
        : 'Could not save your changes. Please try again.');
    }
  }

  if (isLoading || !request) {
    return (
      <Screen>
        <ScreenHeader title="Edit request" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Edit request" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Budget (GHS)</Text>
          <View style={[styles.budgetField, budgetFocused && styles.budgetFieldFocused]}>
            <Text style={styles.budgetCurrency}>GHS</Text>
            <TextInput
              value={budgetText}
              onChangeText={setBudgetText}
              onFocus={() => setBudgetFocused(true)}
              onBlur={() => setBudgetFocused(false)}
              keyboardType="number-pad"
              placeholderTextColor={colors.inkFainter}
              style={styles.budgetInput}
            />
          </View>
        </View>

        <View style={styles.field}>
          <LocationField value={location} onChangeValue={setLocation} userId={profile?.id ?? null} />
        </View>

        <Text style={styles.groupLabel}>DETAILS</Text>
        <View style={styles.groupCard}>
          <View style={[styles.detailBlock, styles.groupRowBorder]}>
            <Text style={styles.groupRowLabel}>Describe the work</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              style={styles.textarea}
              placeholderTextColor={colors.inkFainter}
            />
            <Text style={styles.detailHint}>A clear description helps providers quote accurately.</Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.groupRowLabel}>
              Photos <Text style={styles.groupRowLabelCount}>({totalPhotos}/{MAX_PHOTOS})</Text>
            </Text>
            <View style={styles.photoRow}>
              {existingPhotos.map((url) => (
                <View key={url} style={styles.photoWrap}>
                  <Image source={{ uri: url }} style={styles.photo} />
                  <Pressable
                    hitSlop={10}
                    style={styles.photoRemove}
                    onPress={() => setExistingPhotos((prev) => prev.filter((u) => u !== url))}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this photo"
                  >
                    <X size={12} strokeWidth={3} color={colors.white} />
                  </Pressable>
                </View>
              ))}
              {newPhotoUris.map((uri) => (
                <View key={uri} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} />
                  <Pressable
                    hitSlop={10}
                    style={styles.photoRemove}
                    onPress={() => setNewPhotoUris((prev) => prev.filter((u) => u !== uri))}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this photo"
                  >
                    <X size={12} strokeWidth={3} color={colors.white} />
                  </Pressable>
                </View>
              ))}
              {totalPhotos < MAX_PHOTOS ? (
                <Pressable style={styles.photoAdd} onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Add a photo">
                  {totalPhotos ? (
                    <Plus size={20} strokeWidth={1.8} color={colors.inkFaint} />
                  ) : (
                    <Camera size={20} strokeWidth={1.8} color={colors.inkFaint} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Save changes" variant="active" onPress={handleSave} disabled={!isValid} loading={updateRequest.isPending} />
      </View>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.xl },
    field: { gap: 7 },
    fieldLabel: { fontSize: 12.5, fontFamily: fonts.semibold, color: colors.inkFaint, letterSpacing: 0.2 },

    budgetField: {
      height: 58,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
    },
    budgetFieldFocused: { borderWidth: 1.5, borderColor: colors.ink },
    budgetCurrency: { color: colors.inkFaint, marginRight: 6, fontSize: 17, fontFamily: fonts.medium },
    budgetInput: { flex: 1, fontSize: 20, fontFamily: fonts.mono, color: colors.ink },

    // Small all-caps eyebrow above a grouped card - same idiom as
    // NewRequestScreen's own step 2 and the settings screens.
    groupLabel: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6, marginBottom: -8 },
    groupCard: {
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    groupRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
    groupRowLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    groupRowLabelCount: { fontFamily: fonts.medium, color: colors.inkFainter },

    // Nested directly in the groupCard - no border/background of its own,
    // so it reads as one continuous row rather than a card within a card.
    detailBlock: { padding: spacing.lg, gap: spacing.sm },
    detailHint: { fontSize: 12, lineHeight: 16, fontFamily: fonts.medium, color: colors.inkFaint, marginTop: -4 },
    textarea: {
      minHeight: 96,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
      padding: 0,
      margin: 0,
    },

    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    photoWrap: { width: 72, height: 72 },
    photo: { width: 72, height: 72, borderRadius: radii.lg, backgroundColor: colors.paperDim },
    photoRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: radii.pill,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoAdd: {
      width: 72,
      height: 72,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.paperDim,
      alignItems: 'center',
      justifyContent: 'center',
    },

    errorText: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger },
    footer: { padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.hairline },
  });
}
