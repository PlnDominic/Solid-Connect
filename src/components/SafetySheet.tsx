import { useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Phone, Share2, Siren } from 'lucide-react-native';
import { friendlySafetyError, useCreateSafetyAlert } from '../api/safety';
import { useSessionStore } from '../store/useSessionStore';
import { fonts, radii, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import type { Job } from '../types/database';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

// Ghana's emergency numbers.
const EMERGENCY = [
  { label: 'Emergency 112', number: '112' },
  { label: 'Police 191', number: '191' },
  { label: 'Ambulance 193', number: '193' },
  { label: 'Fire 192', number: '192' },
];

async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const last = await Location.getLastKnownPositionAsync();
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    const coords = fresh?.coords ?? last?.coords;
    return coords ? { lat: coords.latitude, lng: coords.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * The safety tools for an active job: one-tap emergency calls, an alert to
 * the Solid Connect team (with the job and last known location, shown at
 * the top of the admin panel until someone follows up), and a share-my-trip
 * message for a friend or family member. Never gated behind anything: it
 * has to work in a hurry.
 */
export function SafetySheet({
  visible,
  onClose,
  job,
  peerName,
}: {
  visible: boolean;
  onClose: () => void;
  job: Job;
  peerName?: string | null;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const alertTeam = useCreateSafetyAlert(profile?.id);
  const [locating, setLocating] = useState(false);

  function call(number: string) {
    Linking.openURL(`tel:${number}`).catch(() => Alert.alert('Could not open the phone app', `Dial ${number} manually.`));
  }

  async function sendAlert() {
    setLocating(true);
    const position = await currentPosition();
    setLocating(false);
    try {
      await alertTeam.mutateAsync({ jobId: job.id, lat: position?.lat ?? null, lng: position?.lng ?? null });
      onClose();
      Alert.alert('Alert sent', 'The Solid Connect team has been told. If you are in danger, call 112 now.');
    } catch (err) {
      Alert.alert('Could not send the alert', `${friendlySafetyError(err)}\n\nIf you are in danger, call 112.`);
    }
  }

  async function shareTrip() {
    const position = await currentPosition();
    const where = position ? `\nMy location: https://maps.google.com/?q=${position.lat},${position.lng}` : '';
    const message =
      `I'm on a Solid Connect job: "${job.title}"${peerName ? ` with ${peerName}` : ''}.\n` +
      `Address: ${job.location_label}.${where}\nPlease check in on me later.`;
    try {
      await Share.share({ message });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.titleRow}>
        <Siren size={20} strokeWidth={2.2} color={colors.danger} />
        <Text style={styles.title}>Safety</Text>
      </View>
      <Text style={styles.body}>In danger right now? Call for help first.</Text>

      <View style={styles.grid}>
        {EMERGENCY.map((e) => (
          <Pressable
            key={e.number}
            onPress={() => call(e.number)}
            style={[styles.callBtn, e.number === '112' && styles.callBtnMain]}
            accessibilityRole="button"
            accessibilityLabel={`Call ${e.label}`}
          >
            <Phone size={16} strokeWidth={2.2} color={e.number === '112' ? colors.white : colors.danger} />
            <Text style={[styles.callText, e.number === '112' && { color: colors.white }]}>{e.label}</Text>
          </Pressable>
        ))}
      </View>

      <Button title="Alert the Solid Connect team" onPress={sendAlert} loading={locating || alertTeam.isPending} />
      <Text style={styles.note}>Sends this job and your last known location to our team.</Text>

      <Pressable onPress={shareTrip} style={styles.shareBtn} accessibilityRole="button">
        <Share2 size={17} strokeWidth={2.2} color={colors.ink} />
        <Text style={styles.shareText}>Share my trip with someone I trust</Text>
      </Pressable>
    </BottomSheet>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 17, fontFamily: fonts.bold, color: colors.ink },
    body: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular, color: colors.inkMuted },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    callBtn: {
      flexGrow: 1,
      flexBasis: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: colors.dangerBg,
    },
    callBtnMain: { backgroundColor: colors.danger },
    callText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.danger },
    note: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkMuted, textAlign: 'center' },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    shareText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
  });
}
