import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useCreateRequest } from '../../api/requests';
import { useCategories } from '../../api/marketplace';
import { Button } from '../../components/Button';
import { CategoryRow } from '../../components/CategoryTile';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StepBars } from '../../components/StepDots';
import { useSessionStore } from '../../store/useSessionStore';
import { colors, fonts, radii, spacing } from '../../theme';
import type { Category } from '../../types/database';

const DEFAULT_LOCATION = 'East Legon, Accra';
const DEFAULT_BUDGET_MIN = 300;
const DEFAULT_BUDGET_MAX = 600;

export function NewRequestScreen({ navigation }: { navigation: any }) {
  const profile = useSessionStore((s) => s.profile);
  const { data: categories = [] } = useCategories();
  const createRequest = useCreateRequest();

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');

  function selectCategory(c: Category) {
    setCategory(c);
  }

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

  const placeholderDescription = 'Kitchen sink has been leaking under the cabinet since yesterday.';

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
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.label}>What do you need done?</Text>
          <View style={{ gap: 12 }}>
            {categories.map((c) => (
              <CategoryRow
                key={c.id}
                abbr={c.abbr}
                name={c.name}
                selected={category?.id === c.id}
                onPress={() => selectCategory(c)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={{ gap: 7 }}>
            <Text style={styles.fieldLabel}>Service</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyValue}>{category?.default_label ?? ''}</Text>
            </View>
          </View>
          <View style={{ gap: 7 }}>
            <Text style={[styles.fieldLabel, { color: colors.ink }]}>Describe the work</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={placeholderDescription}
              placeholderTextColor={colors.textFaint}
              multiline
              style={styles.textarea}
            />
          </View>
          <View style={{ gap: 7 }}>
            <Text style={styles.fieldLabel}>Photos</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.photoTile} />
              <View style={styles.photoAdd}>
                <Text style={{ color: colors.textFaint, fontSize: 22 }}>+</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={styles.fieldLabel}>When</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyValueSm}>Today</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={styles.fieldLabel}>Budget</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyValueSm}>
                  GHS {DEFAULT_BUDGET_MIN}–{DEFAULT_BUDGET_MAX}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ gap: 7 }}>
            <Text style={styles.fieldLabel}>Location</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyValue}>{DEFAULT_LOCATION}</Text>
            </View>
          </View>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>Review</Text>
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
            <Text style={styles.footerNote}>7 verified plumbers within 5 km of East Legon</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressWrap: { paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.card },
  body: { padding: 16, gap: 20 },
  label: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textMuted, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  readonlyField: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  readonlyValue: { fontSize: 16, color: colors.textHeading },
  readonlyValueSm: { fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  textarea: {
    minHeight: 96,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.card,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  photoTile: { width: 76, height: 76, borderRadius: radii.md, backgroundColor: colors.tile, borderWidth: 1, borderColor: colors.tileBorder },
  photoAdd: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCard: { borderRadius: radii.xxl, backgroundColor: colors.tile, padding: 16, gap: 6 },
  reviewLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  reviewCategory: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  reviewDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  footer: { padding: 16, paddingBottom: 24, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.hairline, gap: 10 },
  footerNote: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
});
