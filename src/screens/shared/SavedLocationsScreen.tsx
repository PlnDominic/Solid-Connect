import { MapPin, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useDeleteSavedLocation, useSavedLocations } from '../../api/savedLocations';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Management screen for the shortcuts LocationField offers when posting a
 * request - "Home", "Work", etc. Deletion only; adding one happens where
 * it's actually useful, on NewRequestScreen's location step.
 */
export function SavedLocationsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: locations = [] } = useSavedLocations(profile?.id ?? null);
  const deleteLocation = useDeleteSavedLocation();

  return (
    <Screen>
      <ScreenHeader title="Saved locations" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {locations.length ? (
          locations.map((loc) => (
            <View key={loc.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <MapPin size={16} strokeWidth={2} color={colors.ink} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.label}>{loc.label}</Text>
                <Text style={styles.area}>{loc.area}</Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() => profile && deleteLocation.mutate({ id: loc.id, userId: profile.id })}
                accessibilityLabel={`Remove ${loc.label}`}
              >
                <Trash2 size={17} strokeWidth={2} color={colors.danger} />
              </Pressable>
            </View>
          ))
        ) : (
          <EmptyState
            title="No saved locations"
            subtitle="When posting a job, name a location (Home, Work) to save it here for next time."
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md },
    card: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperDim,
    },
    label: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    area: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.inkFaint },
  });
}
