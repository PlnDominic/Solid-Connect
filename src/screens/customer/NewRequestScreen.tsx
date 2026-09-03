import { useState } from 'react';
import { Camera, Plus } from 'lucide-react-native';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useCreateRequest } from '../../api/requests';
import { useAllProviders, useCategories } from '../../api/marketplace';
import { Button } from '../../components/Button';
import { CategoryGridTile } from '../../components/CategoryTile';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StepBars } from '../../components/StepDots';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';
import type { Category } from '../../types/database';

const DEFAULT_LOCATION = 'Achimota, Accra';
const DEFAULT_BUDGET_MIN = 300;
const DEFAULT_BUDGET_MAX = 600;

export function NewRequestScreen({ navigation, route }: { navigation: any; route?: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: categories = [] } = useCategories();
  // Real count for the footer trust line below - no fabricated "X within
  // Y km" stat (there's no real geo-matching yet, and provider_category is
  // free text that doesn't map cleanly onto a category id, so this is an
  // honest "verified providers overall" count, not a category-specific one).
  const { data: allProviders = [] } = useAllProviders();
  const verifiedCount = allProviders.filter((p) => p.provider_verified).length;
  const createRequest = useCreateRequest();

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState(route?.params?.initialDescription ?? '');

  function selectCategory(c: Category) {
    setCategory(c);
  }

  const placeholderDescription = 'Kitchen sink has been leaking under the cabinet since yesterday.';

  async function handlePost() {
    if (!profile || !category) return;
    const request = await createRequest.mutateAsync({
      customerId: profile.id,
      categoryId: category.id,
      categoryLabel: category.default_label,
      description: description.trim() || placeholderDescription,
      budgetMin: DEFAULT_BUDGET_MIN,
      budgetMax: DEFAULT_BUDGET_MAX,
      locationLabel: DEFAULT_LOCATION,
    });
    navigation.replace('Matching', { requestId: request.id });
  }

  return (
    <Screen>
      <ScreenHeader
        title="New request"
        onBack={() => (step === 1 ? navigation.goBack() : setStep((s) => s - 1))}
      />
      <View style={styles.progressWrap}>
        <StepBars count={3} step={step} />
      </View>

      {step === 1 && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>What do you need done?</Text>
            <Text style={styles.sectionCount}>{categories.length} categories</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryRow}
          >
            {categories.map((c) => (
              <CategoryGridTile
                key={c.id}
                id={c.id}
                abbr={c.abbr}
                name={c.name}
                description={c.default_label.split('·')[1]?.trim()}
                selected={category?.id === c.id}
                onPress={() => selectCategory(c)}
              />
            ))}
          </ScrollView>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Service</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyValue}>{category?.default_label ?? ''}</Text>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Describe the work</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={placeholderDescription}
              placeholderTextColor={colors.inkFainter}
              multiline
              style={styles.textarea}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Photos</Text>
            <View style={styles.photoRow}>
              <View style={styles.photoAdd}>
                <Camera size={20} strokeWidth={1.8} color={colors.inkFaint} />
              </View>
              <View style={styles.photoAdd}>
                <Plus size={20} strokeWidth={1.8} color={colors.inkFaint} />
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.fieldRow}>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>When</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyValueMono}>Today</Text>
              </View>
            </View>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>Budget</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyValueMono}>
                  GHS {DEFAULT_BUDGET_MIN}-{DEFAULT_BUDGET_MAX}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Location</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyValue}>{DEFAULT_LOCATION}</Text>
            </View>
          </View>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>REQUEST SUMMARY</Text>
            <Text style={styles.reviewCategory}>{category?.default_label}</Text>
            <Text style={styles.reviewDesc}>{description || placeholderDescription}</Text>
          </View>
        </ScrollView>
      )}

      <View style={styles.footer}>
        {step < 3 ? (
          <Button
            title="Continue"
            disabled={step === 1 && !category}
            onPress={() => setStep((s) => s + 1)}
          />
        ) : (
          <>
            <Button title="Post request" onPress={handlePost} loading={createRequest.isPending} />
            {verifiedCount > 0 ? (
              <Text style={styles.footerNote}>{verifiedCount} verified providers ready to help</Text>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, backgroundColor: colors.paper },
  body: { padding: spacing.lg, gap: spacing.xl },

  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionTitle: { fontSize: 16.5, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.3 },
  sectionCount: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkFaint },

  categoryScroll: { marginHorizontal: -spacing.lg },
  categoryRow: { paddingHorizontal: spacing.lg, gap: spacing.md },

  field: { gap: 7 },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  fieldHalf: { flex: 1 },
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

  textarea: {
    minHeight: 100,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.regular,
    color: colors.ink,
    textAlignVertical: 'top',
  },

  photoRow: { flexDirection: 'row', gap: spacing.md },
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
