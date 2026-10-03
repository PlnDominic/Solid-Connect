import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Edit3,
  Plus,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react-native';
import { useProviderEarningsThisMonth } from '../../api/jobs';
import { usePayoutAccount, useUpdatePayoutAccount } from '../../api/payouts';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { haptics } from '../../lib/haptics';
import {
  formatPayoutAccountSummary,
  GHANA_BANKS,
  MOMO_NETWORKS,
  validateBankPayout,
  validateMoMoPayout,
} from '../../lib/payouts';
import { useSessionStore } from '../../store/useSessionStore';
import { fonts, radii, shadow, spacing } from '../../theme';
import { useTheme } from '../../theme/ThemeProvider';
import type { BankPayoutDetails, MoMoNetwork, MoMoPayoutDetails, ProviderPayoutAccount } from '../../types/database';

export function PayoutDetailsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const profile = useSessionStore((s) => s.profile);
  const { data: earnings = 0 } = useProviderEarningsThisMonth(profile?.id ?? null);
  const { data: payoutAccount, isLoading: accountLoading } = usePayoutAccount(profile?.id ?? null);
  const updatePayout = useUpdatePayoutAccount();

  // BottomSheet modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<'momo' | 'bank'>('momo');

  // MoMo form state
  const [network, setNetwork] = useState<MoMoNetwork>('MTN');
  const [momoPhone, setMomoPhone] = useState('');
  const [momoAccountName, setMomoAccountName] = useState('');

  // Bank form state
  const [bankName, setBankName] = useState<string>('GCB Bank');
  const [customBank, setCustomBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  // Sync form inputs with current payout account when modal opens
  useEffect(() => {
    if (modalVisible) {
      setFormError(null);
      if (payoutAccount?.type === 'momo') {
        setSelectedType('momo');
        setNetwork(payoutAccount.network);
        setMomoPhone(payoutAccount.phone);
        setMomoAccountName(payoutAccount.accountName);
      } else if (payoutAccount?.type === 'bank') {
        setSelectedType('bank');
        if (GHANA_BANKS.includes(payoutAccount.bankName as any)) {
          setBankName(payoutAccount.bankName);
          setCustomBank('');
        } else {
          setBankName('Other Bank');
          setCustomBank(payoutAccount.bankName);
        }
        setAccountNumber(payoutAccount.accountNumber);
        setBankAccountName(payoutAccount.accountName);
      } else {
        // Pre-fill with user's profile defaults
        setSelectedType('momo');
        setNetwork('MTN');
        setMomoPhone(profile?.phone ?? '');
        setMomoAccountName(profile?.full_name ?? '');
        setBankName('GCB Bank');
        setBankAccountName(profile?.full_name ?? '');
      }
    }
  }, [modalVisible, payoutAccount, profile]);

  const summary = formatPayoutAccountSummary(payoutAccount);
  const isConfigured = Boolean(payoutAccount);

  async function handleSave() {
    if (!profile) return;
    setFormError(null);

    let newAccount: ProviderPayoutAccount;

    if (selectedType === 'momo') {
      const validation = validateMoMoPayout({
        network,
        phone: momoPhone,
        accountName: momoAccountName,
      });
      if (!validation.valid) {
        setFormError(validation.error ?? 'Please complete all required fields.');
        return;
      }
      newAccount = {
        type: 'momo',
        network,
        phone: momoPhone.trim(),
        accountName: momoAccountName.trim(),
      };
    } else {
      const resolvedBankName = bankName === 'Other Bank' ? customBank.trim() : bankName;
      const validation = validateBankPayout({
        bankName: resolvedBankName,
        accountNumber,
        accountName: bankAccountName,
      });
      if (!validation.valid) {
        setFormError(validation.error ?? 'Please complete all required fields.');
        return;
      }
      newAccount = {
        type: 'bank',
        bankName: resolvedBankName,
        accountNumber: accountNumber.trim(),
        accountName: bankAccountName.trim(),
      };
    }

    try {
      await updatePayout.mutateAsync({
        userId: profile.id,
        account: newAccount,
      });
      haptics.success();
      setModalVisible(false);
      Alert.alert('Payout method saved', 'Your payout destination account has been updated successfully.');
    } catch (e: any) {
      setFormError(e?.message ?? 'Could not save payout details. Please try again.');
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Payout details" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Balance Hero Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available this month</Text>
          <Text style={styles.balanceValue}>GHS {earnings.toLocaleString()}</Text>
          <Text style={styles.balanceNote}>
            Paid into escrow with Hubtel, then sent to your Mobile Money number when the customer confirms.
          </Text>
        </View>

        {/* Payout Method Card */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>RECEIVING ACCOUNT</Text>
          {isConfigured ? (
            <Pressable
              onPress={() => setModalVisible(true)}
              style={styles.editActionRow}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Change payout method"
            >
              <Edit3 size={13} color={colors.ink} strokeWidth={2.4} />
              <Text style={styles.editActionText}>Change</Text>
            </Pressable>
          ) : null}
        </View>

        {accountLoading ? (
          <View style={[styles.cardShadow, styles.loadingCard]}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : isConfigured ? (
          <View style={styles.cardShadow}>
            <View style={styles.card}>
              <View style={styles.configuredRow}>
                <View style={styles.methodIconSlot}>
                  {payoutAccount?.type === 'momo' ? (
                    <Smartphone size={22} color={colors.ink} strokeWidth={2} />
                  ) : (
                    <Building2 size={22} color={colors.ink} strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.titleBadgeRow}>
                    <Text style={styles.methodTitle}>{summary.title}</Text>
                    <View style={styles.activePill}>
                      <Check size={11} color={colors.confirm} strokeWidth={3} />
                      <Text style={styles.activePillText}>Active</Text>
                    </View>
                  </View>
                  <Text style={styles.methodNumber}>{summary.masked}</Text>
                  {summary.holder ? <Text style={styles.methodHolder}>{summary.holder}</Text> : null}
                </View>
              </View>

              <View style={styles.rowBorder} />

              <View style={styles.infoRow}>
                <ShieldCheck size={15} color={colors.confirm} strokeWidth={2.2} />
                <Text style={styles.infoRowText}>Settlement account verified for instant payout transfers.</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.cardShadow}>
            <View style={[styles.card, styles.emptyCard]}>
              <View style={styles.emptyIconSlot}>
                <AlertCircle size={22} color={colors.active} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.emptyTitle}>No payout account configured</Text>
                <Text style={styles.emptyDetail}>
                  Add your MTN MoMo, Telecel Cash, or bank account so customer job payments can reach you.
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(true)}
                style={styles.addBtn}
                accessibilityRole="button"
                accessibilityLabel="Set up payout method"
              >
                <Plus size={15} color={colors.white} strokeWidth={2.6} />
                <Text style={styles.addBtnText}>Set up</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Schedule & Rules Card */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>PAYOUT SCHEDULE</Text>
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.detailTitle}>Automatic release</Text>
                <Text style={styles.detailDesc}>
                  Funds move to your registered wallet once the customer confirms completion on their screen.
                </Text>
              </View>
            </View>
            <View style={styles.rowBorder} />
            <View style={styles.detailRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.detailTitle}>Platform fee deduction</Text>
                <Text style={styles.detailDesc}>
                  Solid Connect service commission is automatically deducted net from the agreed quote.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.disclaimerNote}>
          Payments are processed in Ghana Cedis (GHS). Always ensure the account name matches your registered identity
          document to prevent settlement delays.
        </Text>
      </ScrollView>

      {/* Edit/Configure BottomSheet Modal */}
      <BottomSheet visible={modalVisible} onClose={() => setModalVisible(false)}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>{isConfigured ? 'Update payout account' : 'Set up payout account'}</Text>
            <Text style={styles.modalSubtitle}>Where should your earnings be sent?</Text>
          </View>
          <Pressable onPress={() => setModalVisible(false)} hitSlop={10} style={styles.modalCloseBtn}>
            <X size={18} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* Segmented Type Toggle */}
        <View style={styles.typeSelectorRow}>
          <Pressable
            onPress={() => {
              setSelectedType('momo');
              setFormError(null);
            }}
            style={[styles.typeTab, selectedType === 'momo' && styles.typeTabActive]}
          >
            <Smartphone size={16} color={selectedType === 'momo' ? colors.white : colors.ink} strokeWidth={2.2} />
            <Text style={[styles.typeTabText, selectedType === 'momo' && styles.typeTabTextActive]}>Mobile Money</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSelectedType('bank');
              setFormError(null);
            }}
            style={[styles.typeTab, selectedType === 'bank' && styles.typeTabActive]}
          >
            <Building2 size={16} color={selectedType === 'bank' ? colors.white : colors.ink} strokeWidth={2.2} />
            <Text style={[styles.typeTabText, selectedType === 'bank' && styles.typeTabTextActive]}>Bank Account</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {selectedType === 'momo' ? (
            <View style={styles.formStack}>
              {/* MoMo Network Selection */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Select network</Text>
                <View style={styles.networkGrid}>
                  {MOMO_NETWORKS.map((net) => {
                    const isSelected = network === net.id;
                    return (
                      <Pressable
                        key={net.id}
                        onPress={() => setNetwork(net.id)}
                        style={[styles.networkChip, isSelected && styles.networkChipActive]}
                      >
                        {isSelected ? (
                          <CheckCircle2 size={14} color={colors.white} strokeWidth={2.4} />
                        ) : null}
                        <Text style={[styles.networkChipText, isSelected && styles.networkChipTextActive]}>
                          {net.short}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* MoMo Phone Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile Money phone number</Text>
                <TextInput
                  value={momoPhone}
                  onChangeText={(v) => {
                    setMomoPhone(v);
                    setFormError(null);
                  }}
                  placeholder="024 123 4567"
                  placeholderTextColor={colors.inkFainter}
                  keyboardType="phone-pad"
                  style={styles.textInput}
                />
                <Text style={styles.fieldHint}>Standard 10-digit number registered to your MoMo wallet.</Text>
              </View>

              {/* Account Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Account holder full name</Text>
                <TextInput
                  value={momoAccountName}
                  onChangeText={(v) => {
                    setMomoAccountName(v);
                    setFormError(null);
                  }}
                  placeholder="e.g. Kwame Mensah"
                  placeholderTextColor={colors.inkFainter}
                  autoCapitalize="words"
                  style={styles.textInput}
                />
                <Text style={styles.fieldHint}>Must match the official registered name on the SIM.</Text>
              </View>
            </View>
          ) : (
            <View style={styles.formStack}>
              {/* Bank Name Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Select your bank</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankScroll}>
                  {GHANA_BANKS.map((b) => {
                    const isSelected = bankName === b;
                    return (
                      <Pressable
                        key={b}
                        onPress={() => setBankName(b)}
                        style={[styles.bankChip, isSelected && styles.bankChipActive]}
                      >
                        <Text style={[styles.bankChipText, isSelected && styles.bankChipTextActive]}>{b}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {bankName === 'Other Bank' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Enter bank name</Text>
                  <TextInput
                    value={customBank}
                    onChangeText={(v) => {
                      setCustomBank(v);
                      setFormError(null);
                    }}
                    placeholder="Enter official bank name"
                    placeholderTextColor={colors.inkFainter}
                    style={styles.textInput}
                  />
                </View>
              ) : null}

              {/* Account Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Account number</Text>
                <TextInput
                  value={accountNumber}
                  onChangeText={(v) => {
                    setAccountNumber(v);
                    setFormError(null);
                  }}
                  placeholder="e.g. 1041002345678"
                  placeholderTextColor={colors.inkFainter}
                  keyboardType="number-pad"
                  style={styles.textInput}
                />
              </View>

              {/* Account Holder Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Account holder name</Text>
                <TextInput
                  value={bankAccountName}
                  onChangeText={(v) => {
                    setBankAccountName(v);
                    setFormError(null);
                  }}
                  placeholder="e.g. Kwame Mensah"
                  placeholderTextColor={colors.inkFainter}
                  autoCapitalize="words"
                  style={styles.textInput}
                />
                <Text style={styles.fieldHint}>Must match the bank account records exactly.</Text>
              </View>
            </View>
          )}

          {formError ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={15} color={colors.danger} strokeWidth={2.4} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.modalActionRow}>
            <Button
              title={updatePayout.isPending ? 'Saving...' : 'Save payout account'}
              onPress={handleSave}
              loading={updatePayout.isPending}
            />
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
    balanceCard: { borderRadius: radii.xxl, backgroundColor: colors.navy, padding: spacing.xl, gap: 6 },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: fonts.medium },
    balanceValue: { color: colors.white, fontSize: 28, fontFamily: fonts.extrabold, fontVariant: ['tabular-nums'] },
    balanceNote: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: fonts.medium, marginTop: 4 },

    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      marginTop: spacing.sm,
      marginBottom: 2,
    },
    sectionLabel: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.inkFaint, letterSpacing: 0.6 },
    editActionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    editActionText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },

    cardShadow: { borderRadius: radii.lg, backgroundColor: colors.card, ...shadow.card },
    card: { borderRadius: radii.lg, overflow: 'hidden' },
    loadingCard: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },

    configuredRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.md,
    },
    methodIconSlot: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.paperDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    methodTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.pill,
      backgroundColor: colors.confirmBg,
    },
    activePillText: { fontSize: 11, fontFamily: fonts.bold, color: colors.confirm },
    methodNumber: { fontSize: 13.5, fontFamily: fonts.semibold, color: colors.inkMuted },
    methodHolder: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.inkFaint },

    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.paperDim,
    },
    infoRowText: { fontSize: 12, fontFamily: fonts.medium, color: colors.inkMuted, flex: 1 },

    emptyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.md,
    },
    emptyIconSlot: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.activeBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontSize: 14.5, fontFamily: fonts.bold, color: colors.ink },
    emptyDetail: { fontSize: 12, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 17 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.active,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.md,
    },
    addBtnText: { color: colors.white, fontSize: 12.5, fontFamily: fonts.bold },

    detailRow: { padding: spacing.md, paddingHorizontal: spacing.lg },
    detailTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink },
    detailDesc: { fontSize: 12, fontFamily: fonts.regular, color: colors.inkMuted, lineHeight: 17, marginTop: 2 },
    rowBorder: { height: 1, backgroundColor: colors.hairline },

    disclaimerNote: {
      fontSize: 12,
      fontFamily: fonts.regular,
      color: colors.inkFaint,
      lineHeight: 18,
      marginTop: spacing.sm,
      paddingHorizontal: 2,
    },

    // BottomSheet modal styles
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingBottom: spacing.sm,
    },
    modalTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.ink },
    modalSubtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.inkFaint, marginTop: 2 },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.paperDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalScroll: { maxHeight: 420 },

    typeSelectorRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.paperDim,
      padding: 4,
      borderRadius: radii.lg,
      marginVertical: spacing.xs,
    },
    typeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: radii.md,
    },
    typeTabActive: {
      backgroundColor: colors.ink,
      ...shadow.card,
    },
    typeTabText: { fontSize: 13.5, fontFamily: fonts.semibold, color: colors.ink },
    typeTabTextActive: { color: colors.white },

    formStack: { gap: spacing.md, paddingTop: spacing.sm },
    fieldGroup: { gap: 6 },
    fieldLabel: { fontSize: 12.5, fontFamily: fonts.bold, color: colors.ink },
    fieldHint: { fontSize: 11.5, fontFamily: fonts.regular, color: colors.inkFaint },

    networkGrid: { flexDirection: 'row', gap: spacing.sm },
    networkChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
    },
    networkChipActive: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    networkChipText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.ink },
    networkChipTextActive: { color: colors.white },

    bankScroll: { gap: spacing.xs, paddingVertical: 4 },
    bankChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
    },
    bankChipActive: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    bankChipText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.ink },
    bankChipTextActive: { color: colors.white },

    textInput: {
      borderWidth: 1,
      borderColor: colors.hairlineStrong,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
      fontSize: 15,
      fontFamily: fonts.medium,
      color: colors.ink,
      backgroundColor: colors.paper,
    },

    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.dangerBg,
      padding: spacing.md,
      borderRadius: radii.md,
      marginTop: spacing.sm,
    },
    errorText: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.danger, flex: 1 },
    modalActionRow: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  });
}
