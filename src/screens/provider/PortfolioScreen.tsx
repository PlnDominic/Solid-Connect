import { useState } from 'react';
import { ImagePlus, Images, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useDeletePortfolioPhoto, usePortfolioPhotos, useUploadPortfolioPhoto } from '../../api/portfolio';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';

const MAX_PHOTOS = 12;

export function PortfolioScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: photos = [] } = usePortfolioPhotos(profile?.id);
  const upload = useUploadPortfolioPhoto();
  const remove = useDeletePortfolioPhoto();
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!profile) return <Screen />;

  async function pickAndUpload() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to add portfolio photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.7,
    });
    if (result.canceled) return;
    try {
      await upload.mutateAsync({ providerId: profile!.id, imageUri: result.assets[0].uri });
    } catch (e: any) {
      setError(e?.message ?? 'Could not upload that photo. Please try again.');
    }
  }

  async function handleDelete(id: string, photoUrl: string) {
    setError(null);
    setDeletingId(id);
    try {
      await remove.mutateAsync({ providerId: profile!.id, id, photoUrl });
    } catch (e: any) {
      setError(e?.message ?? 'Could not remove that photo. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Portfolio" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {photos.length === 0 && !upload.isPending ? (
          <EmptyState
            title="No portfolio photos yet"
            subtitle="Add photos of your past work so customers can see what you do."
            icon={Images}
          />
        ) : null}

        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.cell}>
              <Image source={{ uri: photo.photo_url }} style={styles.photo} />
              <Pressable
                hitSlop={8}
                style={styles.removeBadge}
                onPress={() => handleDelete(photo.id, photo.photo_url)}
                disabled={deletingId === photo.id}
              >
                {deletingId === photo.id ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <X size={12} strokeWidth={3} color={colors.white} />
                )}
              </Pressable>
            </View>
          ))}

          {photos.length < MAX_PHOTOS ? (
            <Pressable style={styles.addCell} onPress={pickAndUpload} disabled={upload.isPending}>
              {upload.isPending ? (
                <ActivityIndicator size="small" color={colors.inkFaint} />
              ) : (
                <ImagePlus size={20} strokeWidth={2} color={colors.inkFaint} />
              )}
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const CELL_SIZE = 104;

const styles = StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: CELL_SIZE, height: CELL_SIZE },
  photo: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: radii.md, backgroundColor: colors.paperDim },
  removeBadge: {
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
  addCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  errorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger },
});
