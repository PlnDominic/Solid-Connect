import { useState } from 'react';
import { Clock, ImagePlus, ShieldCheck, X, XCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useLatestVerification, useSubmitVerification } from '../../api/verification';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import { isIdentityVerified, verificationLevelLabel } from '../../lib/verification';

const MAX_DOCS = 3;

function StatusPanel({ icon, bg, fg, label, title, detail }: {
  icon: React.ReactNode;
  bg: string;
  fg: string;
  label: string;
  title: string;
  detail: string;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.statusPanel}>
      <Badge label={label} bg={bg} fg={fg} icon={icon} />
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusDetail}>{detail}</Text>
    </View>
  );
}

function SubmissionForm({ providerId, rejectionNote }: { providerId: string; rejectionNote?: string | null }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmitVerification();

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to attach your ID documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_DOCS - images.length,
      quality: 0.7,
    });
    if (result.canceled) return;
    setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_DOCS));
  }

  function removeImage(uri: string) {
    setImages((prev) => prev.filter((u) => u !== uri));
  }

  async function handleSubmit() {
    setError(null);
    try {
      await submit.mutateAsync({ providerId, imageUris: images });
      setImages([]);
    } catch (e: any) {
      setError(e?.message ?? 'Could not submit your documents. Please try again.');
    }
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {rejectionNote ? (
        <View style={styles.rejectionNote}>
          <XCircle size={16} strokeWidth={2.2} color={colors.danger} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.rejectionNoteTitle}>Your last submission was rejected</Text>
            <Text style={styles.rejectionNoteText}>{rejectionNote}</Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text style={styles.label}>Identity document</Text>
        <Text style={styles.note}>
          Upload a clear photo of a government-issued ID (both sides if applicable). Up to {MAX_DOCS} images.
        </Text>
      </View>

      <View style={styles.thumbRow}>
        {images.map((uri) => (
          <View key={uri} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <Pressable hitSlop={8} style={styles.thumbRemove} onPress={() => removeImage(uri)}>
              <X size={12} strokeWidth={3} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {images.length < MAX_DOCS ? (
          <Pressable style={styles.thumbAdd} onPress={pickImages}>
            <ImagePlus size={20} strokeWidth={2} color={colors.inkFaint} />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        title="Submit for review"
        onPress={handleSubmit}
        disabled={images.length === 0 || submit.isPending}
        loading={submit.isPending}
      />
    </View>
  );
}

export function VerificationScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: latest, isLoading } = useLatestVerification(profile?.id ?? null);

  if (!profile) return <Screen />;

  return (
    <Screen>
      <ScreenHeader title="Verification" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {isIdentityVerified(profile) ? (
          <StatusPanel
            icon={<ShieldCheck size={11} strokeWidth={2.8} color={colors.confirm} />}
            bg={colors.confirmBg}
            fg={colors.confirm}
            label={verificationLevelLabel(profile)}
            title="You're a verified provider"
            detail={`Trust level: ${verificationLevelLabel(profile)}. Customers see your badge across the app.`}
          />
        ) : isLoading ? null : latest?.status === 'pending' ? (
          <StatusPanel
            icon={<Clock size={11} strokeWidth={2.8} color={colors.pending} />}
            bg={colors.pendingBg}
            fg={colors.pending}
            label="Under review"
            title="Your documents are being reviewed"
            detail="We'll update your verification status once an admin has reviewed what you submitted."
          />
        ) : (
          <SubmissionForm providerId={profile.id} rejectionNote={latest?.status === 'rejected' ? latest.note : null} />
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.lg },
    statusPanel: {
      padding: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    statusTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
    statusDetail: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
    label: { fontSize: 13, fontFamily: fonts.semibold, color: colors.inkFaint },
    note: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 19 },
    rejectionNote: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.dangerBg,
    },
    rejectionNoteTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.danger },
    rejectionNoteText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger, lineHeight: 18 },
    thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    thumbWrap: { width: 84, height: 84 },
    thumb: { width: 84, height: 84, borderRadius: radii.md, backgroundColor: colors.paperDim },
    thumbRemove: {
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
    thumbAdd: {
      width: 84,
      height: 84,
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
}
