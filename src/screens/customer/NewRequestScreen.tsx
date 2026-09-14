import { useEffect, useMemo, useState } from 'react';
import { Briefcase, ImagePlus, Plus, UserRound, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useCreateRequest } from '../../api/requests';
import { useAllProviders, useCategories } from '../../api/marketplace';
import { isValidArea } from '../../components/AreaPicker';
import { Button } from '../../components/Button';
import { CategoryGridTile } from '../../components/CategoryTile';
import { LocationField } from '../../components/LocationField';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StepBars } from '../../components/StepDots';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Category } from '../../types/database';

const MAX_PHOTOS = 4;

function bandFor(category: Category | null) {
  const min = category?.budget_min ?? 200;
  const max = category?.budget_max ?? 800;
  return { min, max, mid: Math.round((min + max) / 2) };
}

function matchCategory(
  categories: Category[],
  opts: { id?: string; name?: string },
): Category | null {
  if (opts.id) {
    const byId = categories.find((c) => c.id === opts.id);
    if (byId) return byId;
  }
  const needle = opts.name?.trim().toLowerCase();
  if (!needle) return null;
  return (
    categories.find((c) => c.name.toLowerCase() === needle) ??
    categories.find((c) => c.id.replace(/_/g, ' ') === needle) ??
    categories.find(
      (c) =>
        needle.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(needle),
    ) ??
    null
  );
}

export function NewRequestScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: categories = [] } = useCategories();
  const { data: allProviders = [] } = useAllProviders(null, profile?.area ?? null);
  const verifiedCount = allProviders.filter((p) => p.provider_verified).length;
  const createRequest = useCreateRequest();

  const params = route?.params ?? {};
  const tradeLocked = Boolean(params.initialCategoryId || params.initialCategoryName);
  const preferredProviderId: string | undefined = params.preferredProviderId;
  const preferredProviderName: string | undefined = params.preferredProviderName;
  const isDirect = Boolean(preferredProviderId);

  const [step, setStep] = useState(tradeLocked || isDirect ? 2 : 1);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState(params.initialDescription ?? '');
  const [budgetText, setBudgetText] = useState('');
  const [location, setLocation] = useState(() => {
    const fromProfile = profile?.area?.split(',')[0]?.trim();
    return fromProfile && isValidArea(fromProfile) ? fromProfile : 'Achimota';
  });
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [budgetFocused, setBudgetFocused] = useState(false);

  const band = bandFor(category);
  const budget = parseInt(budgetText.replace(/[^\d]/g, ''), 10);
  // Dynamic validation per entering-data.md: surface the problem the
  // moment it's true, rather than only after Continue is tapped.
  const budgetOutOfRange = budgetText.length > 0 && (!budget || budget < band.min || budget > band.max);

  useEffect(() => {
    if (!categories.length || category) return;
    const matched = matchCategory(categories, {
      id: params.initialCategoryId,
      name: params.initialCategoryName,
    });
    if (matched) setCategory(matched);
  }, [categories, category, params.initialCategoryId, params.initialCategoryName]);

  useEffect(() => {
    if (!category) return;
    const { mid } = bandFor(category);
    setBudgetText((prev) => (prev ? prev : String(mid)));
  }, [category?.id]);

  const stepCount = isDirect ? 1 : tradeLocked ? 2 : 3;
  const progressStep = useMemo(() => {
    if (isDirect) return 1;
    if (!tradeLocked) return step;
    return step === 2 ? 1 : 2;
  }, [isDirect, tradeLocked, step]);

  function selectCategory(c: Category) {
    setCategory(c);
    setBudgetText(String(bandFor(c).mid));
  }

  function handleBack() {
    if (step === 1 || ((tradeLocked || isDirect) && step === 2)) {
      navigation.goBack();
      return;
    }
    setStep((s) => s - 1);
  }

  const placeholderDescription = 'Kitchen sink has been leaking under the cabinet since yesterday.';

  function validateBudget(): string | null {
    if (!category) return 'Pick a service first.';
    if (!budget || Number.isNaN(budget)) return 'Enter your budget.';
    if (budget < band.min || budget > band.max) {
      return `Budget must be between GHS ${band.min} and GHS ${band.max} for ${category.name}.`;
    }
    return null;
  }

  async function pickPhoto() {
    if (photoUris.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to attach request photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.7,
    });
    if (result.canceled) return;
    setPhotoUris((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
  }

  async function handlePost() {
    if (!profile || !category) return;
    if (!isValidArea(location)) {
      setError('Enter a valid location for this request.');
      return;
    }
    const budgetError = validateBudget();
    if (budgetError) {
      setError(budgetError);
      return;
    }
    setError(null);
    try {
      const request = await createRequest.mutateAsync({
        customerId: profile.id,
        categoryId: category.id,
        categoryLabel: category.default_label,
        description: description.trim() || placeholderDescription,
        budget,
        locationLabel: location.includes('Accra') ? location : `${location}, Accra`,
        photoUris,
        preferredProviderId,
      });
      navigation.replace('Matching', {
        requestId: request.id,
        matchedCount: (request as { matchedCount?: number }).matchedCount ?? 0,
        preferredProviderId,
        preferredProviderName,
        direct: Boolean(preferredProviderId),
      });
    } catch (e: any) {
      setError(e?.message ?? 'Could not post that request. Please try again.');
    }
  }

  function handleContinue() {
    if (isDirect && step === 2) {
      void handlePost();
      return;
    }
    if (step === 2) {
      const budgetError = validateBudget();
      if (budgetError) {
        setError(budgetError);
        return;
      }
      setError(null);
    }
    setStep((s) => s + 1);
  }

  const budgetField = (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        Your budget (GHS {band.min}–{band.max})
      </Text>
      <View style={[styles.budgetField, budgetFocused && styles.budgetFieldFocused]}>
        <Text style={styles.budgetCurrency}>GHS</Text>
        <TextInput
          value={budgetText}
          onChangeText={setBudgetText}
          onFocus={() => setBudgetFocused(true)}
          onBlur={() => setBudgetFocused(false)}
          keyboardType="number-pad"
          placeholder={String(band.mid)}
          placeholderTextColor={colors.inkFainter}
          style={styles.budgetInput}
        />
      </View>
      <Text style={[styles.budgetHint, budgetOutOfRange && styles.budgetHintError]}>
        {budgetOutOfRange
          ? `Enter an amount between GHS ${band.min} and GHS ${band.max}.`
          : `Typical range for ${category?.name ?? 'this service'}.`}
      </Text>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader
        title={isDirect ? 'Request provider' : tradeLocked && category ? category.name : 'New request'}
        onBack={handleBack}
      />
      <View style={styles.progressWrap}>
        <StepBars count={stepCount} step={progressStep} />
      </View>

      {step === 1 && !tradeLocked && !isDirect && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>What do you need done?</Text>
            <Text style={styles.sectionCount}>{categories.length} categories</Text>
          </View>
          <View style={styles.categoryGrid}>
            {categories.map((c) => (
              <CategoryGridTile
                key={c.id}
                id={c.id}
                abbr={c.abbr}
                name={c.name}
                selected={category?.id === c.id}
                illustrated
                onPress={() => selectCategory(c)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.groupLabel}>REQUEST</Text>
          <View style={styles.groupCard}>
            <View style={[styles.groupRow, preferredProviderName && styles.groupRowBorder]}>
              <View style={styles.groupRowIcon}>
                <Briefcase size={15} strokeWidth={2} color={colors.inkFaint} />
              </View>
              <View style={styles.groupRowText}>
                <Text style={styles.groupRowLabel}>Service</Text>
                <Text style={styles.groupRowValue}>{category?.default_label ?? 'Loading trade…'}</Text>
              </View>
            </View>
            {preferredProviderName ? (
              <View style={styles.groupRow}>
                <View style={styles.groupRowIcon}>
                  <UserRound size={15} strokeWidth={2} color={colors.inkFaint} />
                </View>
                <View style={styles.groupRowText}>
                  <Text style={styles.groupRowLabel}>Provider</Text>
                  <Text style={styles.groupRowValue}>{preferredProviderName}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {isDirect ? (
            <View style={styles.field}>
              <LocationField value={location} onChangeValue={setLocation} userId={profile?.id ?? null} />
            </View>
          ) : null}

          {budgetField}

          <Text style={styles.groupLabel}>DETAILS</Text>
          <View style={styles.groupCard}>
            <View style={[styles.detailBlock, styles.groupRowBorder]}>
              <Text style={styles.groupRowLabel}>Describe the work</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={placeholderDescription}
                placeholderTextColor={colors.inkFainter}
                multiline
                style={styles.textarea}
              />
              <Text style={styles.detailHint}>A clear description helps providers quote accurately.</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.groupRowLabel}>
                Photos <Text style={styles.groupRowLabelCount}>({photoUris.length}/{MAX_PHOTOS})</Text>
              </Text>
              <Text style={styles.detailHint}>Add photos so providers understand the job before quoting.</Text>
              <View style={styles.photoRow}>
                {photoUris.map((uri) => (
                  <View key={uri} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} />
                    <Pressable
                      hitSlop={10}
                      style={styles.photoRemove}
                      onPress={() => setPhotoUris((prev) => prev.filter((u) => u !== uri))}
                      accessibilityRole="button"
                      accessibilityLabel="Remove this photo"
                    >
                      <X size={12} strokeWidth={3} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
                {photoUris.length < MAX_PHOTOS ? (
                  <Pressable style={styles.photoAdd} onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Add a photo">
                    {photoUris.length ? (
                      <Plus size={20} strokeWidth={1.8} color={colors.inkFaint} />
                    ) : (
                      <ImagePlus size={20} strokeWidth={1.8} color={colors.inkFaint} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      )}

      {step === 3 && !isDirect && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>When</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyValueMono}>Today</Text>
            </View>
          </View>
          {budgetField}
          <View style={styles.field}>
            <LocationField value={location} onChangeValue={setLocation} userId={profile?.id ?? null} />
          </View>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>REQUEST SUMMARY</Text>
            <Text style={styles.reviewCategory}>{category?.default_label}</Text>
            <Text style={styles.reviewDesc}>Budget GHS {budget || '—'}</Text>
            <Text style={styles.reviewDesc}>{description || placeholderDescription}</Text>
            {photoUris.length ? (
              <Text style={styles.reviewDesc}>
                {photoUris.length} photo{photoUris.length === 1 ? '' : 's'} attached
              </Text>
            ) : null}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {step < 3 || isDirect ? (
          <Button
            title={isDirect && step === 2 ? 'Send to provider' : 'Continue'}
            disabled={
              (step === 1 && !category) ||
              (step === 2 && !category) ||
              (isDirect && step === 2 && !isValidArea(location))
            }
            loading={isDirect && step === 2 && createRequest.isPending}
            onPress={handleContinue}
          />
        ) : (
          <>
            <Button
              title="Post request"
              onPress={handlePost}
              loading={createRequest.isPending}
              disabled={!isValidArea(location) || !category}
            />
            {verifiedCount > 0 ? (
              <Text style={styles.footerNote}>{verifiedCount} verified providers ready to help</Text>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    progressWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, backgroundColor: colors.paper },
    body: { padding: spacing.lg, gap: spacing.xl },
    sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    sectionTitle: { fontSize: 16.5, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.3 },
    sectionCount: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    field: { gap: 7 },
    fieldLabel: { fontSize: 12.5, fontFamily: fonts.semibold, color: colors.inkFaint, letterSpacing: 0.2 },
    readonlyField: {
      height: 52,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    readonlyValue: { fontSize: 15, fontFamily: fonts.medium, color: colors.ink },
    readonlyValueMono: { fontSize: 15, fontFamily: fonts.mono, color: colors.ink },

    // Small all-caps eyebrow above a grouped card - same idiom as the
    // settings screens (Account Security, Appearance): the section's own
    // job stated once, quietly, never repeated on every row inside it.
    groupLabel: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6, marginBottom: -8 },
    groupCard: {
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 60,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    groupRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
    groupRowIcon: {
      width: 30,
      height: 30,
      borderRadius: radii.md,
      backgroundColor: colors.paperDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupRowText: { flex: 1, gap: 1 },
    groupRowLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    groupRowLabelCount: { fontFamily: fonts.medium, color: colors.inkFainter },
    groupRowValue: { fontSize: 15.5, fontFamily: fonts.semibold, color: colors.ink },

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
    budgetHint: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },
    budgetHintError: { color: colors.danger },

    // Nested directly in a groupCard - no border/background of its own, so
    // it reads as one continuous row rather than a card within a card.
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
    reviewCard: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.card,
      padding: spacing.lg,
      gap: 6,
    },
    reviewLabel: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    reviewCategory: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    reviewDesc: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.inkMuted },
    errorText: { fontSize: 13, fontFamily: fonts.medium, color: colors.danger },
    footer: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.paper,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      gap: spacing.sm,
    },
    footerNote: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint, textAlign: 'center' },
  });
}
