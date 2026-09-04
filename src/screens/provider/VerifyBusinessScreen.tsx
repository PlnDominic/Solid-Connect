import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { Camera, X } from 'lucide-react-native';
import { useLatestVerification, useSubmitVerification, type PickedDoc } from '../../api/verification';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

const MAX_PHOTOS = 3;

export function VerifyBusinessScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const [photos, setPhotos] = useState<PickedDoc[]>([]);
  const { data: verification } = useLatestVerification(profile?.id ?? null);
  const submit = useSubmitVerification(profile?.id ?? null);

  // Reached again with a submission already in flight (stale back-stack
  // entry, deep link) - show status instead of letting a second
  // concurrent submission through.
  if (verification?.status === 'pending' || verification?.status === 'approved') {
    return (
      <Screen>
        <ScreenHeader title="Verify your business" onBack={() => navigation.goBack()} />
        <View style={styles.statusWrap}>
          <Text style={styles.statusText}>
            {verification.status === 'pending'
              ? "Your documents are pending review. We'll update your profile once an admin has reviewed them."
              : "You're verified - no further action needed."}
          </Text>
        </View>
      </Screen>
    );
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access in Settings to submit verification documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhotos((prev) =>
      prev.length >= MAX_PHOTOS
        ? prev
        : [
            ...prev,
            {
              uri: asset.uri,
              fileName: asset.fileName ?? `doc-${Date.now()}.jpg`,
              mimeType: asset.type === 'image' ? 'image/jpeg' : 'application/octet-stream',
            },
          ]
    );
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function onSubmit() {
    try {
      await submit.mutateAsync(photos);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't submit", e instanceof Error ? e.message : 'Try again.');
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Verify your business" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.note}>
          Add a photo of your government ID and, if you have one, your business certificate. An
          admin reviews these before your profile shows as verified.
        </Text>

        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.uri} style={styles.thumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
              <Pressable style={styles.removeBtn} onPress={() => removePhoto(photo.uri)} hitSlop={8}>
                <X size={12} strokeWidth={3} color={colors.white} />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable style={styles.addTile} onPress={pickPhoto}>
              <Camera size={20} strokeWidth={2} color={colors.inkFaint} />
              <Text style={styles.addLabel}>Add photo</Text>
            </Pressable>
          ) : null}
        </View>

        <Button
          title="Submit for review"
          onPress={onSubmit}
          disabled={photos.length === 0}
          loading={submit.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusWrap: { padding: spacing.lg },
  statusText: { fontSize: 14, fontFamily: fonts.medium, color: colors.inkMuted, lineHeight: 20 },
  body: { padding: spacing.lg, gap: spacing.xl },
  note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { width: 96, height: 96, borderRadius: radii.lg, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(21,24,26,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.card,
  },
  addLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.inkFaint },
});
