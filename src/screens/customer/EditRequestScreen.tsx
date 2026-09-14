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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Describe the work</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            style={styles.textarea}
            placeholderTextColor={colors.inkFainter}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Budget (GHS)</Text>
          <TextInput
            value={budgetText}
            onChangeText={setBudgetText}
            keyboardType="number-pad"
            style={styles.input}
            placeholderTextColor={colors.inkFainter}
          />
        </View>

        <View style={styles.field}>
          <LocationField value={location} onChangeValue={setLocation} userId={profile?.id ?? null} />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Photos ({totalPhotos}/{MAX_PHOTOS})
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Save changes" onPress={handleSave} disabled={!isValid} loading={updateRequest.isPending} />
      </View>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.xl },
    field: { gap: spacing.sm },
    fieldLabel: { fontSize: 12.5, fontFamily: fonts.semibold, color: colors.inkFaint, letterSpacing: 0.2 },
    input: {
      height: 52,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.ink,
    },
    textarea: {
      minHeight: 100,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.md,
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.ink,
      textAlignVertical: 'top',
    },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    photoWrap: { width: 72, height: 72, borderRadius: radii.md, overflow: 'visible' },
    photo: { width: 72, height: 72, borderRadius: radii.md },
    photoRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: radii.pill,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoAdd: {
      width: 72,
      height: 72,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
    },
    errorText: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger },
    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.hairline },
  });
}
