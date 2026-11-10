import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CalendarDays, Clock, ImagePlus, Plus, Sparkles, X, Zap } from 'lucide-react-native';
import { useCategories } from '../../api/marketplace';
import {
  START_LABELS,
  formatJobPostBudget,
  formatJobPostStart,
  friendlyPostError,
  useCreateJobPost,
  type JobPostBudgetType,
  type JobPostStart,
} from '../../api/jobPosts';
import { isValidArea } from '../../components/AreaPicker';
import { Button } from '../../components/Button';
import { CategoryGridTile } from '../../components/CategoryTile';
import { LocationField } from '../../components/LocationField';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StepBars } from '../../components/StepDots';
import { haptics } from '../../lib/haptics';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, fontSizes, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { Category } from '../../types/database';

const MAX_PHOTOS = 4;
const MIN_TITLE = 4;
const MIN_DESCRIPTION = 20;

type StepKey = 'service' | 'details' | 'budget' | 'when' | 'review';
const STEPS: StepKey[] = ['service', 'details', 'budget', 'when', 'review'];

const BUDGET_TYPES: { id: JobPostBudgetType; label: string; hint: string }[] = [
  { id: 'range', label: 'Price range', hint: 'Give a low and high figure' },
  { id: 'fixed', label: 'Fixed price', hint: 'One amount for the whole job' },
  { id: 'negotiable', label: 'Open to offers', hint: 'Let providers propose a price' },
];

const START_OPTIONS: { id: JobPostStart; icon: typeof Zap }[] = [
  { id: 'asap', icon: Zap },
  { id: 'this_week', icon: Clock },
  { id: 'flexible', icon: Sparkles },
  { id: 'date', icon: CalendarDays },
];

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextDays(count: number) {
  const out: { iso: string; weekday: string; day: string }[] = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    out.push({
      iso: toIsoDate(d),
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: String(d.getDate()),
    });
  }
  return out;
}

function parseAmount(text: string): number | null {
  const n = parseInt(text.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PostJobScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: categories = [] } = useCategories();
  const createPost = useCreateJobPost();
  const params = route?.params ?? {};

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const [category, setCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(params.initialDescription ?? '');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [budgetType, setBudgetType] = useState<JobPostBudgetType>('range');
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [startPreference, setStartPreference] = useState<JobPostStart>('flexible');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [location, setLocation] = useState(() => {
    const fromProfile = profile?.area?.split(',')[0]?.trim();
    return fromProfile && isValidArea(fromProfile) ? fromProfile : '';
  });
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => nextDays(14), []);
  const minAmount = parseAmount(minText);
  const maxAmount = parseAmount(maxText);

  const budgetValid =
    budgetType === 'negotiable' ||
    (budgetType === 'fixed' && maxAmount != null) ||
    (budgetType === 'range' && minAmount != null && maxAmount != null && minAmount <= maxAmount);
  const budgetError =
    budgetType === 'range' && minAmount != null && maxAmount != null && minAmount > maxAmount
      ? 'The low figure must be less than the high figure.'
      : null;

  const titleValid = title.trim().length >= MIN_TITLE;
  const descriptionValid = description.trim().length >= MIN_DESCRIPTION;
  const whenValid = startPreference !== 'date' || !!startDate;
  const whereValid = isValidArea(location);

  const draftBudget = {
    budget_type: budgetType,
    budget_min: budgetType === 'fixed' ? maxAmount : minAmount,
    budget_max: maxAmount,
  };

  const canContinue =
    step === 'service'
      ? !!category
      : step === 'details'
        ? titleValid && descriptionValid
        : step === 'budget'
          ? budgetValid
          : step === 'when'
            ? whenValid && whereValid
            : !!category && titleValid && descriptionValid && budgetValid && whenValid && whereValid;

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

  function selectCategory(c: Category) {
    setCategory(c);
    if (!title.trim()) setTitle(c.default_label);
    if (!minText && c.budget_min) setMinText(String(c.budget_min));
    if (!maxText && c.budget_max) setMaxText(String(c.budget_max));
  }

  async function pickPhoto() {
    if (photoUris.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to add photos to your job post.');
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
    setError(null);
    try {
      const post = await createPost.mutateAsync({
        customerId: profile.id,
        categoryId: category.id,
        categoryLabel: category.name,
        title,
        description,
        budgetType,
        budgetMin: budgetType === 'fixed' ? maxAmount : minAmount,
        budgetMax: maxAmount,
        locationLabel: location.includes('Accra') ? location : `${location}, Accra`,
        startPreference,
        startDate: startPreference === 'date' ? startDate : null,
        photoUris,
      });
      haptics.success();
      navigation.replace('JobPostDetail', { postId: post.id, justPosted: true });
    } catch (e: any) {
      setError(friendlyPostError(e));
    }
  }

  function handleContinue() {
    if (isLast) {
      void handlePost();
      return;
    }
    goTo(stepIndex + 1);
  }

  return (
    <Screen bg={colors.paperDim}>
      <ScreenHeader title="Post a Job" onBack={handleBack} />
      <View style={styles.progressWrap}>
        <StepBars count={STEPS.length} step={stepIndex + 1} />
        <Text style={styles.progressText}>
          Step {stepIndex + 1} of {STEPS.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 'service' && (
          <>
            <Question title="What kind of job is it?" subtitle="Pick the trade so the right providers find it." styles={styles} />
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

        {step === 'details' && (
          <>
            <Question
              title="Describe the job"
              subtitle="A clear title and a few details help providers decide quickly."
              styles={styles}
            />
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Job title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                onFocus={() => setFocused('title')}
                onBlur={() => setFocused(null)}
                placeholder="e.g. Fix leaking kitchen sink"
                placeholderTextColor={colors.inkFainter}
                maxLength={120}
                style={[styles.input, focused === 'title' && styles.inputFocused]}
                accessibilityLabel="Job title"
              />
            </View>
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Details</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                onFocus={() => setFocused('description')}
                onBlur={() => setFocused(null)}
                placeholder="What needs doing, how big is it, anything a provider should bring?"
                placeholderTextColor={colors.inkFainter}
                multiline
                maxLength={2000}
                style={[styles.textarea, focused === 'description' && styles.inputFocused]}
                accessibilityLabel="Job details"
              />
              <Text style={styles.hint}>
                {descriptionValid
                  ? 'Looks good.'
                  : `Write at least ${MIN_DESCRIPTION} characters (${description.trim().length}/${MIN_DESCRIPTION}).`}
              </Text>
            </View>

            <View style={[styles.card, styles.section]}>
              <Text style={styles.label}>
                Photos <Text style={styles.labelAside}>optional · {photoUris.length}/{MAX_PHOTOS}</Text>
              </Text>
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
                  <Pressable style={styles.photoAdd} onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Add a photo">
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
              subtitle={
                category?.budget_min && category?.budget_max
                  ? `Most ${category.name.toLowerCase()} jobs cost GHS ${category.budget_min} to ${category.budget_max}.`
                  : 'Set a budget or let providers make an offer.'
              }
              styles={styles}
            />
            <View style={styles.optionList}>
              {BUDGET_TYPES.map((o) => {
                const active = budgetType === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setBudgetType(o.id)}
                    style={[styles.option, active && styles.optionActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>{o.label}</Text>
                      <Text style={styles.optionHint}>{o.hint}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {budgetType === 'range' ? (
              <View style={styles.amountRow}>
                <AmountField
                  label="From"
                  value={minText}
                  onChange={setMinText}
                  focused={focused === 'min'}
                  onFocus={() => setFocused('min')}
                  onBlur={() => setFocused(null)}
                  styles={styles}
                  placeholderColor={colors.inkFainter}
                />
                <AmountField
                  label="To"
                  value={maxText}
                  onChange={setMaxText}
                  focused={focused === 'max'}
                  onFocus={() => setFocused('max')}
                  onBlur={() => setFocused(null)}
                  styles={styles}
                  placeholderColor={colors.inkFainter}
                />
              </View>
            ) : budgetType === 'fixed' ? (
              <AmountField
                label="Amount"
                value={maxText}
                onChange={setMaxText}
                focused={focused === 'max'}
                onFocus={() => setFocused('max')}
                onBlur={() => setFocused(null)}
                styles={styles}
                placeholderColor={colors.inkFainter}
              />
            ) : (
              <Text style={styles.hint}>Providers will include their price when they show interest.</Text>
            )}
            {budgetError ? <Text style={[styles.hint, styles.hintError]}>{budgetError}</Text> : null}
          </>
        )}

        {step === 'when' && (
          <>
            <Question title="When and where?" subtitle="Tell providers when you need it and which area it is in." styles={styles} />
            <View style={styles.optionGrid}>
              {START_OPTIONS.map(({ id, icon: Icon }) => {
                const active = startPreference === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setStartPreference(id)}
                    style={[styles.startTile, active && styles.optionActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Icon size={18} strokeWidth={2.2} color={active ? colors.active : colors.inkMuted} />
                    <Text style={[styles.startLabel, active && styles.startLabelActive]}>{START_LABELS[id]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {startPreference === 'date' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
                {days.map((d) => {
                  const active = startDate === d.iso;
                  return (
                    <Pressable
                      key={d.iso}
                      onPress={() => setStartDate(d.iso)}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.dayWeek, active && styles.dayTextActive]}>{d.weekday}</Text>
                      <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.day}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <View style={styles.card}>
              <LocationField label="Area" value={location} onChangeValue={setLocation} userId={profile?.id ?? null} />
            </View>
          </>
        )}

        {step === 'review' && (
          <>
            <Question
              title="Review your post"
              subtitle="Once posted, every provider on Solid Connect can see it on their feed."
              styles={styles}
            />
            <View style={styles.summary}>
              <Text style={styles.summaryTitle} numberOfLines={2}>
                {title.trim()}
              </Text>
              <SummaryRow label="Service" value={category?.name ?? '-'} styles={styles} onEdit={() => goTo(0)} />
              <SummaryRow label="Budget" value={formatJobPostBudget(draftBudget)} styles={styles} onEdit={() => goTo(2)} />
              <SummaryRow
                label="Start"
                value={formatJobPostStart({ start_preference: startPreference, start_date: startDate })}
                styles={styles}
                onEdit={() => goTo(3)}
              />
              <SummaryRow label="Area" value={location || '-'} styles={styles} onEdit={() => goTo(3)} />
              <SummaryRow
                label="Photos"
                value={photoUris.length ? `${photoUris.length} attached` : 'None'}
                styles={styles}
                onEdit={() => goTo(1)}
              />
              <Text style={styles.summaryDescription}>{description.trim()}</Text>
            </View>
          </>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isLast ? 'Post job' : 'Continue'}
          variant="active"
          disabled={!canContinue}
          loading={isLast && createPost.isPending}
          onPress={handleContinue}
        />
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

function AmountField({
  label,
  value,
  onChange,
  focused,
  onFocus,
  onBlur,
  styles,
  placeholderColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  styles: Styles;
  placeholderColor: string;
}) {
  return (
    <View style={styles.amountWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.amountField, focused && styles.inputFocused]}>
        <Text style={styles.amountCurrency}>GHS</Text>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^\d]/g, ''))}
          onFocus={onFocus}
          onBlur={onBlur}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={placeholderColor}
          style={styles.amountInput}
          accessibilityLabel={`${label} amount in Ghana cedis`}
        />
      </View>
    </View>
  );
}

function SummaryRow({ label, value, styles, onEdit }: { label: string; value: string; styles: Styles; onEdit: () => void }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
      <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${label}`}>
        <Text style={styles.summaryEdit}>Edit</Text>
      </Pressable>
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
    card: { borderRadius: radii.xxxl, backgroundColor: colors.card, padding: spacing.lg, ...shadow.card },
    label: { fontSize: fontSizes.lg, fontFamily: fonts.bold, color: colors.ink },
    labelAside: { fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.inkFaint },
    fieldLabel: { fontSize: fontSizes.xs, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    hint: { fontSize: fontSizes.md, lineHeight: 22, fontFamily: fonts.medium, color: colors.inkMuted },
    hintError: { color: colors.danger },

    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },

    input: {
      height: 56,
      borderRadius: radii.xxl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: colors.card,
      ...shadow.card,
      paddingHorizontal: spacing.lg,
      fontSize: fontSizes.lg,
      fontFamily: fonts.semibold,
      color: colors.ink,
    },
    textarea: {
      minHeight: 160,
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

    optionList: { gap: spacing.sm },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.xxl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: colors.card,
      ...shadow.card,
    },
    optionActive: { borderColor: colors.active },
    optionTitle: { fontSize: fontSizes.md, fontFamily: fonts.bold, color: colors.ink },
    optionHint: { fontSize: fontSizes.sm, fontFamily: fonts.regular, color: colors.inkMuted, marginTop: 2 },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioActive: { borderColor: colors.active },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.active },

    amountRow: { flexDirection: 'row', gap: spacing.md },
    amountWrap: { flex: 1, gap: spacing.sm },
    amountField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      height: 64,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.xxl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: colors.card,
      ...shadow.card,
    },
    amountCurrency: { fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.inkFaint },
    amountInput: { flex: 1, fontSize: fontSizes.xxl, fontFamily: fonts.mono, color: colors.ink, padding: 0 },

    optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    startTile: {
      width: '48.5%',
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radii.xxl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: colors.card,
      ...shadow.card,
    },
    startLabel: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.ink },
    startLabelActive: { color: colors.active },

    dayRow: { gap: spacing.sm, paddingVertical: 2 },
    dayChip: {
      width: 56,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: 2,
      borderRadius: radii.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.hairline,
    },
    dayChipActive: { backgroundColor: colors.active, borderColor: colors.active },
    dayWeek: { fontSize: fontSizes.xs, fontFamily: fonts.semibold, color: colors.inkMuted },
    dayNum: { fontSize: fontSizes.lg, fontFamily: fonts.extrabold, color: colors.ink },
    dayTextActive: { color: colors.white },

    summary: {
      borderRadius: radii.xxxl,
      backgroundColor: colors.card,
      ...shadow.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    summaryTitle: { fontSize: fontSizes.lg, fontFamily: fonts.extrabold, color: colors.ink, paddingVertical: spacing.sm },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
    summaryLabel: { width: 70, fontSize: fontSizes.md, fontFamily: fonts.medium, color: colors.inkMuted },
    summaryValue: { flex: 1, fontSize: fontSizes.md, fontFamily: fonts.semibold, color: colors.ink, textAlign: 'right' },
    summaryEdit: { fontSize: fontSizes.sm, fontFamily: fonts.bold, color: colors.active },
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
    },
  });
}
