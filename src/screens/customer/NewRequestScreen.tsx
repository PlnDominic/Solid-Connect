import { useEffect, useState } from 'react';
import { ImagePlus, Plus, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useCreateRequest } from '../../api/requests';
import { useAllProviders, useCategories } from '../../api/marketplace';
import { resolvedLocationFromAreaLabel } from '../../api/location';
import { isValidArea } from '../../components/AreaPicker';
import { Button } from '../../components/Button';
import { CategoryGridTile } from '../../components/CategoryTile';
import { LocationField } from '../../components/LocationField';
import { Screen } from '../../components/Screen';
import { SlotPicker } from '../../components/SlotPicker';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StepBars } from '../../components/StepDots';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Category } from '../../types/database';

const MAX_PHOTOS = 4;
const MIN_DESCRIPTION = 10;

// One question per screen. Which screens a customer sees depends on how
// they arrived: a trade picked on Home skips 'service', and a request to
// one named provider asks for a time slot on the 'where' screen.
type StepKey = 'service' | 'problem' | 'budget' | 'where';

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

  const steps: StepKey[] =
    tradeLocked || isDirect ? ['problem', 'budget', 'where'] : ['service', 'problem', 'budget', 'where'];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState(params.initialDescription ?? '');
  const [budgetText, setBudgetText] = useState('');
  const [location, setLocation] = useState(() => {
    const fromProfile = profile?.area?.trim();
    return fromProfile && isValidArea(fromProfile) ? fromProfile : 'Achimota';
  });
  const [locationLat, setLocationLat] = useState<number | undefined>(() => {
    const fromProfile = profile?.area?.trim();
    const label = fromProfile && isValidArea(fromProfile) ? fromProfile : 'Achimota';
    return resolvedLocationFromAreaLabel(label).lat;
  });
  const [locationLng, setLocationLng] = useState<number | undefined>(() => {
    const fromProfile = profile?.area?.trim();
    const label = fromProfile && isValidArea(fromProfile) ? fromProfile : 'Achimota';
    return resolvedLocationFromAreaLabel(label).lng;
  });
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [budgetFocused, setBudgetFocused] = useState(false);

  const band = bandFor(category);
  const budget = parseInt(budgetText.replace(/[^\d]/g, ''), 10);
  const budgetValid = Boolean(budget) && budget >= band.min && budget <= band.max;
  // Dynamic validation per entering-data.md: surface the problem the
  // moment it's true, rather than only after Continue is tapped.
  const budgetOutOfRange = budgetText.length > 0 && !budgetValid;
  // Providers quote from this text, so it has to describe this job - never
  // fall back to the sample sentence in the placeholder.
  const descriptionLength = description.trim().length;
  const descriptionValid = descriptionLength >= MIN_DESCRIPTION;

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

  function selectCategory(c: Category) {
    setCategory(c);
    setBudgetText(String(bandFor(c).mid));
  }

  function goTo(index: number) {
    setError(null);
    setStepIndex(index);
  }

  function handleBack() {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    goTo(stepIndex - 1);
  }

  const placeholderDescription = 'Kitchen sink has been leaking under the cabinet since yesterday.';

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
    if (!budgetValid || !descriptionValid) {
      setError('Go back and check your description and budget.');
      return;
    }
    setError(null);
    try {
      const request = await createRequest.mutateAsync({
        customerId: profile.id,
        categoryId: category.id,
        categoryLabel: category.default_label,
        description: description.trim(),
        budget,
        locationLabel: location.trim(),
        locationLat,
        locationLng,
        photoUris,
        preferredProviderId,
        preferredTime: preferredTime ? new Date(preferredTime) : undefined,
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

  // Continue only unlocks once this screen's one answer is valid, so the
  // customer never learns about a problem on a later screen.
  const canContinue =
    step === 'service'
      ? Boolean(category)
      : step === 'problem'
        ? Boolean(category) && descriptionValid
        : step === 'budget'
          ? budgetValid
          : Boolean(category) && isValidArea(location);

  function handleContinue() {
    if (isLast) {
      void handlePost();
      return;
    }
    goTo(stepIndex + 1);
  }

  const tradeName = category?.name.toLowerCase();

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader
        title={isDirect && preferredProviderName ? `Request ${preferredProviderName}` : 'New request'}
        onBack={handleBack}
      />
      <View style={styles.progressWrap}>
        <StepBars count={steps.length} step={stepIndex + 1} />
        <Text style={styles.progressText}>
          Step {stepIndex + 1} of {steps.length}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'service' && (
          <>
            <Question
              title="What do you need done?"
              subtitle="Pick the service that fits your job best."
              styles={styles}
            />
            <View style={styles.categoryGrid}>
              {categories.map((c) => (
                <CategoryGridTile
                  key={c.id}
                  id={c.id}
                  abbr={c.abbr}
                  name={c.name}
                  selected={category?.id === c.id}
                  illustrated
                  elevated
                  onPress={() => selectCategory(c)}
                />
              ))}
            </View>
          </>
        )}

        {step === 'problem' && (
          <>
            <Question
              title="What's the problem?"
              subtitle={`Describe the ${tradeName ? tradeName + ' ' : ''}job in your own words. Providers quote from this.`}
              styles={styles}
            />
            <View style={styles.section}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                onFocus={() => setDescriptionFocused(true)}
                onBlur={() => setDescriptionFocused(false)}
                placeholder={placeholderDescription}
                placeholderTextColor={colors.inkFainter}
                multiline
                style={[styles.textarea, descriptionFocused && styles.inputFocused]}
                accessibilityLabel="Describe the work"
              />
              <Text style={styles.hint}>
                {descriptionValid
                  ? 'Looks good. More detail helps you get accurate quotes.'
                  : `Write at least ${MIN_DESCRIPTION} characters (${descriptionLength}/${MIN_DESCRIPTION}).`}
              </Text>
            </View>

            <View style={[styles.card, styles.section]}>
              <Text style={styles.label}>
                Photos <Text style={styles.labelAside}>optional · {photoUris.length}/{MAX_PHOTOS}</Text>
              </Text>
              <Text style={styles.hint}>A photo or two shows providers the job before they quote.</Text>
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
                      <X size={13} strokeWidth={3} color={colors.white} />
                    </Pressable>
                  </View>
                ))}
                {photoUris.length < MAX_PHOTOS ? (
                  <Pressable
                    style={styles.photoAdd}
                    onPress={pickPhoto}
                    accessibilityRole="button"
                    accessibilityLabel="Add a photo"
                  >
                    {photoUris.length ? (
                      <Plus size={24} strokeWidth={1.8} color={colors.inkMuted} />
                    ) : (
                      <ImagePlus size={24} strokeWidth={1.8} color={colors.inkMuted} />
                    )}
                    <Text style={styles.photoAddText}>Add</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </>
        )}

        {step === 'budget' && (
          <>
            <Question
              title="What's your budget?"
              subtitle={`Most ${tradeName ? tradeName + ' ' : ''}jobs cost between GHS ${band.min} and GHS ${band.max}.`}
              styles={styles}
            />
            <View style={styles.section}>
              <View
                style={[
                  styles.budgetField,
                  budgetFocused && styles.budgetFieldFocused,
                  budgetOutOfRange && styles.budgetFieldError,
                ]}
              >
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
                  accessibilityLabel="Your budget in Ghana cedis"
                />
              </View>
              <Text style={[styles.hint, budgetOutOfRange && styles.hintError]}>
                {budgetOutOfRange
                  ? `Enter an amount between GHS ${band.min} and GHS ${band.max}.`
                  : 'Providers can quote above or below this. You choose who to hire.'}
              </Text>
            </View>
          </>
        )}

        {step === 'where' && (
          <>
            <Question
              title={isDirect ? 'Where and when?' : "Where's the job?"}
              subtitle={
                isDirect
                  ? `Tell ${preferredProviderName ?? 'the provider'} where to come, and pick a time if you like.`
                  : 'Providers near this area will see your request.'
              }
              styles={styles}
            />
            <View style={styles.card}>
              <LocationField
                label="Area"
                value={location}
                onChangeValue={setLocation}
                onChangeLocation={(loc) => {
                  setLocation(loc.area);
                  setLocationLat(loc.lat);
                  setLocationLng(loc.lng);
                }}
                userId={profile?.id ?? null}
              />
            </View>

            {isDirect && preferredProviderId ? (
              <View style={styles.card}>
                <SlotPicker providerId={preferredProviderId} value={preferredTime} onChange={setPreferredTime} />
              </View>
            ) : null}

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Your request</Text>
              <SummaryRow label="Service" value={category?.default_label ?? '—'} styles={styles} />
              {preferredProviderName ? (
                <SummaryRow label="Provider" value={preferredProviderName} styles={styles} />
              ) : null}
              {!isDirect ? <SummaryRow label="When" value="Today" styles={styles} /> : null}
              <SummaryRow label="Budget" value={`GHS ${budget || '—'}`} mono styles={styles} />
              <SummaryRow
                label="Photos"
                value={photoUris.length ? `${photoUris.length} attached` : 'None'}
                styles={styles}
              />
              <Text style={styles.summaryDescription} numberOfLines={4}>
                {description.trim()}
              </Text>
            </View>
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isLast ? (isDirect ? 'Send to provider' : 'Post request') : 'Continue'}
          variant="active"
          disabled={!canContinue}
          loading={isLast && createRequest.isPending}
          onPress={handleContinue}
        />
        {isLast && !isDirect && verifiedCount > 0 ? (
          <Text style={styles.footerNote}>{verifiedCount} verified providers ready to help</Text>
        ) : null}
      </View>
    </Screen>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Question({ title, subtitle, styles }: { title: string; subtitle: string; styles: Styles }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.questionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
  styles,
}: {
  label: string;
  value: string;
  mono?: boolean;
  styles: Styles;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, mono && styles.summaryValueMono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    progressWrap: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.paper,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    progressText: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkMuted },
    body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xxl },

    question: { gap: spacing.sm },
    questionTitle: { fontSize: fontSizes.title, lineHeight: 34, fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.6 },
    questionSubtitle: { fontSize: fontSizes.md, lineHeight: 23, fontFamily: fonts.regular, color: colors.inkMuted },

    section: { gap: spacing.sm },
    // Raised white card on the dimmed page - shadow does the separating.
    card: { borderRadius: radii.xxxl, backgroundColor: colors.card, padding: spacing.lg, ...shadow.card },
    label: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.ink },
    labelAside: { fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.inkFaint },
    hint: { fontSize: fontSizes.md, lineHeight: 22, fontFamily: fonts.medium, color: colors.inkMuted },
    hintError: { color: colors.danger },

    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },

    textarea: {
      minHeight: 168,
      borderRadius: radii.xxxl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: colors.card,
      ...shadow.card,
      padding: spacing.lg,
      fontSize: fontSizes.lg,
      lineHeight: 26,
      fontFamily: fonts.regular,
      color: colors.ink,
      textAlignVertical: 'top',
    },
    inputFocused: { borderColor: colors.active },

    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
    photoWrap: { width: 88, height: 88 },
    photo: { width: 88, height: 88, borderRadius: radii.xl, backgroundColor: colors.paperDim },
    photoRemove: {
      position: 'absolute',
      top: -7,
      right: -7,
      width: 26,
      height: 26,
      borderRadius: radii.pill,
      backgroundColor: colors.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoAdd: {
      width: 88,
      height: 88,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.hairlineStrong,
      backgroundColor: colors.paperDim,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    photoAddText: { fontSize: fontSizes.sm, fontFamily: fonts.semibold, color: colors.inkMuted },

        budgetField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderRadius: radii.xxxl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: colors.card,
      ...shadow.card,
    },
    budgetFieldFocused: { borderColor: colors.active },
    budgetFieldError: { borderColor: colors.danger },
    budgetCurrency: { fontSize: fontSizes.xxl, fontFamily: fonts.semibold, color: colors.inkFaint },
    budgetInput: { flex: 1, fontSize: fontSizes.display, fontFamily: fonts.mono, color: colors.ink, padding: 0 },

    summary: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.card,
      ...shadow.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    summaryTitle: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.ink, paddingVertical: spacing.sm },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    summaryLabel: { fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.inkMuted },
    summaryValue: { flexShrink: 1, fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.ink, textAlign: 'right' },
    summaryValueMono: { fontFamily: fonts.mono },
    summaryDescription: {
      fontSize: fontSizes.md,
      lineHeight: 23,
      fontFamily: fonts.regular,
      color: colors.inkMuted,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },

    errorText: { fontSize: fontSizes.md, lineHeight: 22, fontFamily: fonts.semibold, color: colors.danger },
    footer: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.paper,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      gap: spacing.sm,
    },
    footerNote: { fontSize: fontSizes.sm, fontFamily: fonts.medium, color: colors.inkMuted, textAlign: 'center' },
  });
}
